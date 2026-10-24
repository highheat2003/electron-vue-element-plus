import json
import os
import socket
import sys
import threading

import uvicorn

from app.main import create_app


def main() -> None:
    # Bind before announcing the port, avoiding the usual free-port race.
    app = create_app(os.environ.get("DESKTOP_BACKEND_TOKEN", ""))
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen(128)
        config = uvicorn.Config(app, log_level="warning", access_log=False)
        server = uvicorn.Server(config)

        def watch_parent() -> None:
            # A graceful shutdown command or parent death closes this private pipe.
            for line in sys.stdin:
                if line.strip() == "shutdown":
                    break
            server.should_exit = True

        threading.Thread(target=watch_parent, daemon=True).start()
        print(json.dumps({"event": "ready", "port": listener.getsockname()[1]}), flush=True)
        server.run(sockets=[listener])


if __name__ == "__main__":
    main()
