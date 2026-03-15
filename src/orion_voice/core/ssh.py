"""SSH command execution for remote targets (e.g. Mac Mini)."""
from __future__ import annotations

import asyncio
import logging
import shlex
from dataclasses import dataclass
from typing import Optional

from orion_voice.core.config import SSHSettings, SSHTarget

logger = logging.getLogger(__name__)


@dataclass
class SSHResult:
    exit_code: int
    stdout: str
    stderr: str


def _find_target(settings: SSHSettings, name: str) -> Optional[SSHTarget]:
    """Look up an SSH target by name (case-insensitive)."""
    for target in settings.targets:
        if target.name.lower() == name.lower():
            return target
    return None


def _build_ssh_args(target: SSHTarget, command: str, timeout: int) -> list[str]:
    """Build the ssh command-line arguments."""
    args = [
        "ssh",
        "-o", "BatchMode=yes",
        "-o", f"ConnectTimeout={timeout}",
        "-o", "StrictHostKeyChecking=accept-new",
        "-p", str(target.port),
    ]
    if target.identity_file:
        args.extend(["-i", target.identity_file])
    args.append(f"{target.user}@{target.host}")
    args.append(command)
    return args


async def run_ssh_command(
    settings: SSHSettings,
    target_name: str,
    command: str,
) -> SSHResult:
    """Execute a command on the named SSH target.

    Uses the system ``ssh`` binary so that the user's existing SSH config,
    agent, and known-hosts are respected.
    """
    target = _find_target(settings, target_name)
    if target is None:
        known = ", ".join(t.name for t in settings.targets) or "(none)"
        return SSHResult(
            exit_code=-1,
            stdout="",
            stderr=f"Unknown SSH target '{target_name}'. Known targets: {known}",
        )

    if not command.strip():
        return SSHResult(exit_code=-1, stdout="", stderr="No command provided")

    args = _build_ssh_args(target, command, settings.timeout)
    logger.info("SSH %s: %s", target_name, command)

    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout_bytes, stderr_bytes = await asyncio.wait_for(
            proc.communicate(),
            timeout=settings.timeout + 5,
        )
        result = SSHResult(
            exit_code=proc.returncode or 0,
            stdout=stdout_bytes.decode("utf-8", errors="replace"),
            stderr=stderr_bytes.decode("utf-8", errors="replace"),
        )
    except asyncio.TimeoutError:
        result = SSHResult(exit_code=-1, stdout="", stderr="SSH command timed out")
    except FileNotFoundError:
        result = SSHResult(exit_code=-1, stdout="", stderr="ssh binary not found on this system")
    except Exception as exc:
        result = SSHResult(exit_code=-1, stdout="", stderr=str(exc))

    if result.exit_code != 0:
        logger.warning("SSH %s exit=%d stderr=%s", target_name, result.exit_code, result.stderr.strip())
    else:
        logger.info("SSH %s exit=0 stdout=%d bytes", target_name, len(result.stdout))

    return result
