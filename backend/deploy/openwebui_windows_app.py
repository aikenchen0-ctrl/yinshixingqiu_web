import asyncio

from open_webui.main import (
    WEBUI_ADMIN_EMAIL,
    WEBUI_ADMIN_NAME,
    WEBUI_ADMIN_PASSWORD,
    app,
)
from open_webui.utils.auth import create_admin_user


class EnsureRuntimeStateMiddleware:
    def __init__(self, inner_app):
        self.inner_app = inner_app

    async def __call__(self, scope, receive, send):
        if not hasattr(app.state, "main_loop"):
            app.state.main_loop = asyncio.get_running_loop()

        await self.inner_app(scope, receive, send)


if WEBUI_ADMIN_EMAIL and WEBUI_ADMIN_PASSWORD:
    if create_admin_user(
        WEBUI_ADMIN_EMAIL,
        WEBUI_ADMIN_PASSWORD,
        WEBUI_ADMIN_NAME,
    ):
        app.state.config.ENABLE_SIGNUP = False

app.state.startup_complete = True
app.add_middleware(EnsureRuntimeStateMiddleware)

application = app
