"""Swagger UI responsif + sentuhan brand Lukla untuk halaman /docs.

Halaman /docs bawaan FastAPI tidak punya viewport meta dan tabelnya meluber
di layar HP. Modul ini menggantinya dengan HTML yang sama (tetap memakai
aset swagger-ui bawaan FastAPI) ditambah viewport + CSS responsif.
"""

from fastapi import FastAPI
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import HTMLResponse

SWAGGER_RESPONSIVE_CSS = """
/* Brand Lukla pada topbar Swagger */
.swagger-ui .topbar { background: linear-gradient(135deg, #4C1D95 0%, #DB2777 100%); }
.swagger-ui .topbar .download-url-wrapper .download-url-button { background: rgba(255,255,255,0.2); }
@media (max-width: 768px) {
  .swagger-ui .wrapper { padding: 0 12px; }
  .swagger-ui .topbar { padding: 8px 0; }
  .swagger-ui .topbar .topbar-wrapper { flex-wrap: wrap; gap: 8px; }
  .swagger-ui .info { margin: 16px 0; }
  .swagger-ui .info .title { font-size: 1.4rem; line-height: 1.3; }
  .swagger-ui .info .title small { display: block; margin-top: 4px; }
  .swagger-ui .scheme-container { flex-wrap: wrap; gap: 8px; }
  .swagger-ui .auth-wrapper { flex-wrap: wrap; gap: 8px; }
  .swagger-ui .opblock .opblock-summary { flex-wrap: wrap; gap: 6px; }
  .swagger-ui .opblock-summary-path { word-break: break-all; max-width: 100% !important; }
  .swagger-ui .opblock-summary-description { width: 100%; }
  .swagger-ui table { display: block; width: 100%; overflow-x: auto; }
  .swagger-ui .parameters-col_description { min-width: 200px; }
  .swagger-ui .opblock-body pre.microlight,
  .swagger-ui .opblock-body code { white-space: pre-wrap; word-break: break-word; }
  .swagger-ui input[type=text],
  .swagger-ui textarea,
  .swagger-ui select { max-width: 100%; }
  .swagger-ui .servers > label select { max-width: calc(100vw - 120px); }
  .swagger-ui .dialog-ux .modal-ux { max-width: calc(100vw - 24px); margin: 12px auto; }
  .swagger-ui .response-col_status { min-width: 60px; }
}
"""


def register_responsive_docs(app: FastAPI, *, openapi_url: str = "/openapi.json", title: str) -> None:
    """Daftarkan GET /docs kustom (disembunyikan dari skema OpenAPI)."""

    @app.get("/docs", include_in_schema=False)
    async def custom_swagger_ui() -> HTMLResponse:
        base = get_swagger_ui_html(openapi_url=openapi_url, title=title)
        content = base.body.decode("utf-8")
        extra_head = f"<style>{SWAGGER_RESPONSIVE_CSS}</style></head>"
        if 'name="viewport"' not in content:
            extra_head = '<meta name="viewport" content="width=device-width, initial-scale=1" />' + extra_head
        return HTMLResponse(content.replace("</head>", extra_head, 1))
