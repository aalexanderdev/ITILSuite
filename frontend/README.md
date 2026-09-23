# ITILSuite Frontend (Legacy Prototype / Archived)

> [!NOTE]
> **Aviso de Migración y Retiro**:
> La interfaz web de usuario de **ITILSuite** ha sido completamente migrada a una arquitectura de renderizado del lado del servidor (SSR) compilada de forma nativa en **Rust con Askama + Axum + HTMX** y diseño *Material Design 2 Warm Dark & Clean Light Theme* servida directamente desde el binario `itilsuite-backend` en `http://localhost:8081`.
> 
> Esta carpeta (`frontend/`) se conserva exclusivamente con fines de referencia histórica del prototipo inicial en React. Para ejecutar o desarrollar la aplicación en producción o local, ya no se requiere Node.js, npm ni Vite.

---

## Ejecución del Sistema Consolidado
Para ejecutar ITILSuite con su interfaz web nativa completa:

```bash
# 1. Iniciar base de datos PostgreSQL y Mailpit
docker compose up -d

# 2. Iniciar el servidor backend nativo con SSR integrado
cargo run --bin itilsuite-backend
```

Acceder a: `http://localhost:8081`
* **Credenciales por defecto**: `admin` / `admin`
