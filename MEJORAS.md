# Análisis y Oportunidades de Mejora — ImgTools (SPA)

Documento generado a partir de la auditoría técnica de `index.html`, `README.md` y la revisión de hoja de ruta funcional. Sirve como *backlog* priorizado de correcciones, nuevas funcionalidades y mejoras de arquitectura.

---

## 1. Corrección de Bugs y Casos Borde (Prioridad Alta)

- [x] **Truncamiento de 1 píxel en relaciones de aspecto periódicas (`1919×1080` en vez de `1920×1080`, incluido el Modo BalBino)** *(implementado en `v2.0.0-beta.2`)*
  - **Ubicación:** `index.html` (opciones de `<select id="aspectRatio">`, `parseRatioValue()`, `computeRawDimensions()`, `calculateDimensions()` y `balbinoMode`).
  - **Causa raíz:** Los ratios `4:3`, `16:9` y `21:9` están codificados como decimales truncados (`1.3333`, `1.7777`, `2.3333`). Para `1080p`, `1080 * 1.7777 = 1919.916`; al asignarlo a `elements.canvas.width = outWidth` (entero sin signo WebIDL), el navegador trunca a **`1919 px`**, mientras que `#destRes` usa `Math.round(outWidth)` y muestra **`1920 x 1080 px`**. Afecta igualmente a `4:3` (`1439×1080`), `21:9` (`2519×1080`) y a dimensiones fraccionarias sin redondear.
  - **Solución propuesta:** Codificar los valores del `<select>` como razones exactas (`"4:3"`, `"16:9"`, `"16:10"`, `"21:9"`, `"21:10"`) evaluadas mediante división real (`w / h`), actualizar `balbinoMode` a `"16:9"` y devolver siempre enteros redondeados en `calculateDimensions()`:
    ```javascript
    return { outWidth: Math.round(outWidth), outHeight: Math.round(outHeight) };
    ```

- [x] **El botón "Adaptar (no lineal)" queda bloqueado al activar relación personalizada desde "Libre (original)"** *(implementado en `v2.0.0-beta.2`)*
  - **Ubicación:** `index.html` (`updateUI()` y listener de `customRatioToggle`).
  - **Problema:** Al cargar una imagen, `aspectRatio` vale `'free'` y `updateUI()` deshabilita `#fitENL` (`disabled = true`, `opacity: 0.5`). Al marcar la casilla *Personalizada (ancho:alto)*, su listener ejecuta `updateCanvas()` pero omite llamar a `updateUI()`, dejando el botón *Adaptar (no lineal)* bloqueado hasta que el usuario interactúa con otro control.
  - **Solución propuesta:** Invocar `updateUI()` antes de `updateCanvas()` dentro del listener `change` de `customRatioToggle`.

- [x] **El "Modo BalBino" no limpia estados de deformación previos ni aplica su estilo dorado `.balbino-glow`** *(implementado en `v2.0.0-beta.2`)*
  - **Ubicación:** `index.html` (CSS `.balbino-glow`, activación en `fileInput`/`factoryReset` y manejador click de `balbinoMode`).
  - **Problema 1:** Pulsar `#balbinoMode` no resetea `state.stretchActive` ni `state.enlActive` (ni oculta `#enlSettings`), y tampoco recalcula `autoSelectANLAxis()` si ANL estaba activo con otro eje; además, si había recorte circular, esquinas o suavizado activos, los conserva en una cabecera pensada para WordPress. Tampoco limpia el `setTimeout` previo del aviso `#balbinoNotice`.
  - **Problema 2:** La animación dorada `.balbino-glow` definida en `<style>` (descrita en `README.md` como *"Un botón dorado"*) nunca se asigna al botón `#balbinoMode`.
  - **Solución propuesta:** Restablecer `state.enlActive = false`, `state.stretchActive = false`, ocultar `#enlSettings`, poner a cero efectos de borde/círculo, guardar el ID del temporizador con `clearTimeout` y aplicar la clase `balbino-glow` cuando hay imagen cargada (respetando `prefers-reduced-motion`).

- [x] **El suavizado perimetral (*feather*) no llega a opacidad 0% en el borde exterior del lienzo** *(implementado en `v2.0.0-beta.2`)*
  - **Ubicación:** `index.html` (`updateCanvas()`, canvas auxiliar `maskCanvas`).
  - **Causa raíz:** La máscara con `globalCompositeOperation = 'destination-in'` y `ctx.filter = blur(...)` se rellena exactamente hasta los bordes `[0, outWidth] × [0, outHeight]`. Como la mitad del kernel gaussiano cae fuera del lienzo, la opacidad en el perímetro exterior queda cortada al ~50% generando un escalón visible en vez de desvanecerse suavemente a transparente.
  - **Solución propuesta:** Retranquear (*inset*) el trazado de la máscara en una distancia proporcional al radio de desenfoque (`inset = feather`, ajustando el radio de esquina como `Math.max(0, borderRadius - inset)` y aplicando `blur(${feather / 3}px)` en un canvas auxiliar para llegar a opacidad 0% real en todo el perímetro).

- [x] **Discrepancia entre fondo blanco en vista previa y fondo negro al exportar a JPG con transparencias** *(implementado en `v2.0.0-beta.2`)*
  - **Ubicación:** `index.html` (CSS `.canvas-checkerboard`, `updateUI()` y `updateCanvas()`).
  - **Problema:** El buffer del canvas se limpia con `ctx.clearRect()` (transparente), pero el CSS pinta `background-color: white` en modo claro y `#000` en modo oscuro. Cuando hay zonas transparentes (*Contener*, *Radio de esquinas*, *Recorte circular*, *Suavizado* o PNG transparente) y se exporta a `JPG` (sin canal alfa), el navegador convierte el transparente en **negro puro (`#000000`)**, contradiciendo lo visto en pantalla en modo claro.
  - **Solución propuesta:** Mostrar un patrón damero CSS para formatos con transparencia (`PNG`/`WEBP`) y pintar explícitamente fondo blanco (`#ffffff` con `destination-over`) en el `<canvas>` cuando el formato sea `image/jpeg`.

- [x] **Artefactos verticales/horizontales en imágenes con semitransparencia al usar Adaptación No Lineal (ANL)** *(implementado en `v2.0.0-beta.2`)*
  - **Ubicación:** `index.html` (`updateCanvas()`).
  - **Causa raíz:** Para tapar huecos subpíxel entre las 60 rebanadas, cada `ctx.drawImage` suma `+ 0.5` px al ancho/alto de destino (`sx.targetSize + 0.5`). En PNG/WebP con sombras o zonas semitransparentes, ese solapamiento de `0.5 px` duplica el canal alfa en las 59 uniones, dibujando una rejilla visible.
  - **Solución propuesta:** Alinear las coordenadas de destino de cada rebanada a píxeles enteros contiguos (`const x0 = Math.round(startX + sx.targetStart); const x1 = Math.round(startX + sx.targetStart + sx.targetSize);` dibujando con ancho `x1 - x0` y análogo en eje Y).

- [x] **El peso de salida y el porcentaje de ahorro no se actualizan en tiempo real y quedan obsoletos** *(implementado en `v2.0.0-beta.2`)*
  - **Ubicación:** `index.html` (`scheduleOutputSizeUpdate()`, `applyOutputSizeUI()`, `resetOutputSizeUI()`, listeners `#outFormat`/`#quality`/`#downloadBtn`).
  - **Problema:** Pese a figurar como *"Información en tiempo real"* en `README.md`, `#destSize` y `#savingsTag` solo se calculan al pulsar *Descargar imagen*, no se limpian al pulsar *Restablecer todos los ajustes* y quedan desactualizados si después de descargar se cambia formato, calidad o tamaño. Además, si el archivo exportado pesa más que el original (`savings <= 0`), la etiqueta simplemente se oculta sin advertir del incremento.
  - **Solución propuesta:** Calcular el tamaño de salida de forma asíncrona con `canvas.toBlob()` y *debounce* (`250 ms`) ante cualquier cambio de lienzo, formato o calidad (cancelando cálculos obsoletos mediante contador de secuencia), mostrando insignia verde (`-X%`) si ahorra peso y ámbar (`+X%`) si aumenta.

- [x] **Mensajes de validación `#ratioError` y `#exportError` inactivos (código muerto) y falta de tope máximo de lienzo** *(implementado en `v2.0.0-beta.2`)*
  - **Ubicación:** `index.html` (`validateConfig()`, `setFieldErrorState()`, `calculateDimensions()` y atributos ARIA en `#customW`, `#customH`, `#exportSize`).
  - **Problema:** `#ratioError` y `#exportError` existen en el HTML y en `elements`, pero ningún código los muestra cuando el usuario escribe `0`, valores negativos o deja el campo vacío; tampoco se limita `exportSize` al máximo soportado por el navegador (`16384 px` en Canvas 2D estándar), pudiendo dejar el lienzo en blanco o agotar memoria.
  - **Solución propuesta:** Validar rangos (`1–16384 px` en tamaño y dimensiones resultantes; `> 0` en ratio personalizado), sincronizar `aria-invalid`/`aria-describedby` junto a `#ratioError`/`#exportError` y deshabilitar `#downloadBtn` mientras la configuración sea inválida.

---

## 2. Nuevas Funcionalidades y Herramientas

- [ ] **Procesamiento por lotes (*Batch*) de múltiples imágenes con descarga en `.zip` (eje principal de `v2.0`)**
  - **Cero fricción con 1 sola imagen:** Añadir el atributo `multiple` a `#fileInput` y al *Drag & Drop* / pegado `Ctrl+V`; si solo hay 1 imagen cargada, la interfaz se comporta exactamente igual que en `v1.0`.
  - **Receta global + encuadre individual opcional (`2+` imágenes):** Mostrar una tira o carrusel compacto de miniaturas con contador, botón *Añadir más*, borrado individual y *Vaciar lote*. Los ajustes de encuadre base, **🚀 Modo BalBino**, efectos, dimensiones, formato y calidad actúan como **receta común** para todo el lote, pero cada elemento `batchItems[i]` conserva su propio estado ligero (`zoom`, `panX`, `panY`, modo de ajuste y desplazamiento ANL) para poder corregir en pocos segundos solo las fotos donde el autoencuadre corte un rostro o logotipo.
  - **Exportación secuencial ligera en RAM y empaquetado `.zip`:** Procesar de una en una (`async/await` + `yieldToMain`) con modal y barra de progreso (`Procesando X de N…`), reutilizando un único `<canvas>` en memoria y liberando cada `ObjectURL` tras generar su `Blob`. Empaquetar el resultado en un único archivo `.zip` (mediante `JSZip` fijado con `SRI` como en *PDF Tools* o contenedor `.zip` ligero en modo `STORE` sin recomprimir, más opción de descarga individual) mostrando el peso total antes/después y el porcentaje global de ahorro.

- [x] **Importación nativa de imágenes vectoriales SVG (`image/svg+xml`) y otros formatos modernos (`AVIF`, `GIF`, `BMP`)** *(implementado en v2.0.0-beta.4)*
  - **Situación actual:** `#fileInput` (`index.html`, línea ~143) restringe `accept="image/jpeg, image/png, image/webp"`, impidiendo seleccionar archivos `.svg` (así como `.avif`, `.gif` estáticos o `.bmp`).
  - **Particularidades técnicas de SVG en Canvas 2D a cubrir:** Muchos archivos `.svg` carecen de atributos `width`/`height` en píxeles en la raíz (definen solo `viewBox` o porcentajes `100%`), lo que en Firefox devuelve `img.naturalWidth === 0` y en otros navegadores rasteriza a baja resolución si el `viewBox` es pequeño (p. ej. iconos `24×24`).
  - **Solución propuesta:** Al detectar `image/svg+xml` o extensión `.svg`, leer el XML (`file.text()`), validar con `DOMParser`, asegurar `xmlns="http://www.w3.org/2000/svg"`, deducir la relación de aspecto real desde `viewBox` (o `width`/`height`) e inyectar dimensiones numéricas de alta densidad (escalando el lado mayor al menos a `2048 px` o al tamaño de exportación objetivo) en un `Blob` `image/svg+xml;charset=utf-8` cargado vía `<img>` (que aísla scripts/recursos externos evitando *tainted canvas* al exportar a WebP/PNG/JPG).

- [x] **Carga rápida mediante *Drag & Drop* global y pegado desde el portapapeles (`Ctrl+V`) + "Copiar al portapapeles"** *(implementado en v2.0.0-beta.4)*
  - Permitir arrastrar y soltar una imagen directamente sobre cualquier punto del área de trabajo (`#canvasWrapper` / ventana) con superposición visual de soltado.
  - Escuchar el evento `paste` (`clipboardData.items`) para cargar capturas de pantalla o recortes sin pasar por archivos temporales (respetando campos `<input>` activos).
  - Añadir botón secundario *"Copiar imagen"* junto a *Descargar* usando `navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])` para pegarla al instante en Google Slides, Docs o WordPress.

- [x] **Selector de relleno de fondo para modo "Contener" y transparencias (Transparente, Color sólido y *Blur-fill* / Fondo desenfocado)** *(implementado en v2.0.0-beta.4)*
  - Al encuadrar fotos verticales o cuadradas en `16:9` con *Contener* (p. ej. fotos de grupo donde no conviene estirar bordes con ANL), permitir elegir entre:
    - **Transparente** (para `PNG`/`WEBP`, con vista previa sobre cuadrícula damero).
    - **Fondo desenfocado (*Blur-fill*):** Dibuja en una capa inferior la propia imagen escalada en modo *Llenar* con `blur(32px)` y ligero oscurecimiento/aclarado ajustable, generando cabeceras editoriales limpias en un clic.
    - **Color sólido** (blanco, negro o selector `<input type="color">`).

- [x] **Nuevos preajustes rápidos de redes y plataformas educativas (respetando el Modo BalBino)** *(implementado en v2.0.0-beta.4)*
  - Recogiendo la idea abierta en `README.md` (línea ~101), incorporar un desplegable o tira compacta de *Perfiles rápidos* (sin tocar el protagonismo del botón **🚀 Modo BalBino**): p. ej. *LinkedIn Post* (`1200×627`), *LinkedIn Banner* (`1584×396`), *Instagram Cuadrado / Vertical* (`1080×1080` / `1080×1350`), *Miniatura YouTube* (`1280×720`) y *Cabecera Google Classroom / Forms* (`1000×250` / `1600×400`), con opción de guardar un preajuste propio en `localStorage`.

- [x] **Transformaciones geométricas previas (Rotar 90° izq/der y Voltear horizontal/vertical)** *(implementado en v2.0.0-beta.4)*
  - Controles compactos de giro en pasos de `90°` y espejo horizontal/vertical antes del encuadre y de la Adaptación No Lineal, muy útiles para corregir fotos móviles o invertir la dirección de la mirada del sujeto en una cabecera.

- [x] **Vista rápida de comparación Antes / Después y exportación opcional a AVIF** *(implementado en v2.0.0-beta.4)*
  - Botón *"Mantener para ver original"* (o barra espaciadora / tecla rápida) para comparar al instante el encuadre y la distorsión ANL frente a la imagen de origen.
  - Detectar en el arranque si el navegador soporta codificación `image/avif` en `<canvas>` y habilitarlo dinámicamente como opción adicional en `#outFormat`.

- [ ] **Integración opcional *client-side* con Google Drive (abrir origen y guardar cabecera optimizada)** *(en pausa por decisión de alcance, al igual que en PDF Tools)*
  - Siguiendo la misma arquitectura sin servidor planteada en *PDF Tools (SPA)*: **Google Identity Services** + **Google Picker API** con el scope no sensible `https://www.googleapis.com/auth/drive.file` (sin límite de 100 usuarios al pasar a producción ni auditoría CASA), cargando los scripts de Google de forma perezosa solo al pulsar *"Drive"* y ocultándolos si `navigator.onLine === false`.

---

## 3. Experiencia de Usuario (UX) e Interfaz

- [x] **Corregir geometría del icono de cabecera y unificarlo con el favicon SVG (y futuros iconos PWA)** *(implementado en `v2.0.0-beta.3`)*
  - **Ubicación:** `index.html` (favicon Data URI en línea ~8, `<svg>` de `<header>` en líneas ~148–159) y copias estáticas `assets/favicon.png` / `assets/logo.png`.
  - **Problemas detectados:** En el `<svg>` de cabecera el cuadrado redondeado y la lente se centran en `(35, 40)`, pero las escuadras derechas están en `x = 43` en lugar de `48` (marco estrecho `21×36` descentrado en `x = 32.5` del que el círculo blanco sobresale por la derecha hasta `48.25`), además de incrustar `<text>` dependiente de métricas de fuente web. En el favicon falta `viewBox="0 0 512 512"`, falta `stroke-linejoin="round"` (creando esquinas exteriores en inglete agudo junto a puntas redondeadas) y el anillo del círculo (`r=110`, borde exterior `122`) colisiona físicamente con las 4 escuadras (distancia interior `119.8`), fusionándose a `16×16 px`.
  - **Solución propuesta:** Definir un único pictograma maestro `viewBox="0 0 512 512"` simétrico, con `stroke-linejoin="round"` y separación limpia entre trazos, compartido entre el favicon Data URI, el `<header>` (`40×40 px` separado del texto HTML semántico `ImgTools`) y los futuros iconos `icons/` de la PWA.

- [x] **Extender la edición numérica clicable (`setupQuickInput`) a todas las etiquetas de valor** *(implementado en `v2.0.0-beta.3`)*
  - `README.md` (línea ~86) indica que se puede hacer clic *"en cualquier etiqueta de valor"*, pero actualmente `setupQuickInput()` solo está conectada a `#featherLabel` y `#radiusLabel` (`index.html`, líneas ~894–895).
  - Extenderla a `Zoom` (`#zoomVal`), `Calidad` (`#qualityVal`), `Zona segura` (`#enlSafeVal`), `Desplazamiento` (`#enlBiasXVal` / `#enlBiasYVal`) y `Transición` (`#enlPowerVal`), soportando valores decimales/negativos según el control y cancelación con `Escape`.

- [x] **Unificar nombres de archivo exportados (`${nombre_original}_${ancho}x${alto}.${ext}`) y extensión `.jpg`** *(implementado en `v2.0.0-beta.3`)*
  - En `index.html` (línea ~1041) se exporta siempre `img_tools_${Date.now()}.${format.split('/')[1]}`, perdiendo el nombre original y generando `.jpeg` en lugar de `.jpg`.
  - Conservar el nombre base del archivo cargado sin extensión y añadir dimensiones de salida (ej. `jornada-geg_1920x1080.webp` o `_balbino.webp`), mapeando `image/jpeg` → `.jpg`.

- [x] **Zoom exponencial anclado al cursor y soporte táctil completo (*Pinch-to-Zoom*)** *(implementado en `v2.0.0-beta.3`)*
  - En `wheel` (`index.html`, líneas ~999–1002), sustituir el incremento lineal fijo por escala multiplicativa suave y ajustar `panX`/`panY` para mantener fijo el punto de la imagen bajo el puntero; permitir también restablecer zoom/encuadre con doble clic sobre el lienzo.
  - Migrar los eventos de lienzo a *Pointer Events* o añadir gestión de 2 toques en `touchmove` para permitir pellizcar para hacer zoom y desplazar simultáneamente en móviles y tabletas.

- [x] **Accesibilidad (a11y), atajos de teclado y modal `<dialog>` semántico** *(implementado en `v2.0.0-beta.3`)*
  - Añadir `aria-label` y `title` descriptivos en botones solo-icono (`#themeToggle`, `#infoBtn`, `#zoomOut`, `#zoomIn`, `#closeInfo`).
  - Migrar `#infoModal` a `<dialog>` nativo (cierre automático con `Escape` y gestión de foco) e incorporar atajos de teclado globales no intrusivos: `Ctrl+O` (abrir), `Ctrl+S` (descargar), `0` / `Ctrl+0` (restablecer vista) y flechas para ajuste fino de `panX`/`panY` (`1 px`, `10 px` con `Mayús`).
  - Persistir en `localStorage` la preferencia de tema claro/oscuro cuando el usuario la conmute manualmente.

---

## 4. Rendimiento y Gestión de Memoria

- [x] **Sustituir cadenas Base64 (`FileReader.readAsDataURL` / `canvas.toDataURL`) por `Blob` y Object URLs con liberación explícita** *(implementado en `v2.0.0-beta.3`)*
  - **Ubicación:** `index.html` (carga en líneas ~497–520 y exportación en líneas ~1033–1041).
  - Cargar el archivo de entrada mediante `URL.createObjectURL(file)` revocándolo en `img.onload`, y exportar mediante `canvas.toBlob()` + `URL.createObjectURL(blob)` revocando tras la descarga (`setTimeout(() => URL.revokeObjectURL(url), 1000)`). Reduce el consumo de RAM hasta un ~50% al trabajar con fotografías de 24–50 MP o salidas en 4K.

- [x] **Agrupar redibujados en `requestAnimationFrame` y separar las guías ANL en un `<canvas>` o SVG superpuesto** *(implementado en `v2.0.0-beta.3`)*
  - En pantallas de 120–144 Hz, mover el ratón o un deslizador ejecuta `updateCanvas()` (60 llamadas `drawImage` + `ctx.filter = blur(...)`) varias veces por fotograma. Planificar el pintado con `requestAnimationFrame` y dibujar las guías temporales de zona segura fuera del canvas de exportación mejora la fluidez en 2K/4K y evita cualquier riesgo de que una guía quede impresa en el archivo descargado.

- [x] **Escalado progresivo (*step-down*) para grandes reducciones de tamaño** *(implementado en `v2.0.0-beta.3`)*
  - Al reducir imágenes de cámaras de alta resolución (p. ej. `6000×4000` → `480p` o `720p`, factor `< 0.5`), algunos motores 2D muestran *aliasing*/*moiré* incluso con `imageSmoothingQuality = 'high'`. Reducir por mitades sucesivas en un canvas auxiliar fuera de pantalla cuando `method !== 'pixel'` mejora notablemente la nitidez final.

---

## 5. Arquitectura, Seguridad y Despliegue

- [ ] **Plan de migración progresiva de Google Sites (`<iframe>`) a GitHub Pages y canal Beta (rama `v2.0`)**
  - **Fase 0 — Saneado previo del repositorio Git local (✅ completada):** En la copia local sincronizada con Insync, `.git/objects/cb` figuraba como un archivo plano de `647 B` (código XML del favicon SVG) en lugar de un subdirectorio `.git/objects/cb/`, lo que impedía guardar el blob `cb463c8df7...` de `assets/favicon.png` e interrumpía el recorrido de `git fsck`. Tras respaldar el archivo intruso y eliminarlo, se restituyó el objeto exacto mediante `git hash-object -w assets/favicon.png` y se verificó `git fsck --full --strict` (`256/256` directorios, `0` errores).
  - **Fase 1 — Etiquetado de la versión actual en producción (`v1.0`) y despliegue Beta en GitHub Pages (`v2.0`) (✅ completada en `v2.0.0-beta.1`):**
    1. Creado tag anotado `v1.0` y **GitHub Release `v1.0`** sobre `main` (`737486d`), preservando intacta la versión estable actualmente publicada mediante inserción en Google Sites (`imgtools.pablofelip.online`).
    2. Creada la rama `v2.0` (`origin/v2.0`) para desarrollar la nueva generación con soporte *batch* y configurado **GitHub Pages** en `pfelipm/imgtools` desplegando desde la raíz de `v2.0`, obteniendo actualización automática en **`https://pfelipm.github.io/imgtools/`** con cada `git push` (`v2.0.0-beta.1`, `beta.2`, etc.).
    3. **Control de versión y aviso del canal Beta en `#infoModal` y `README.md` (patrón *PDF Tools*):** Añadidas en `index.html` las constantes `APP_VERSION` y `APP_BUILD_DATE` renderizadas en la insignia `#app-version-badge` dentro de `#infoModal`, junto con `#beta-channel-notice` en el propio modal y una alerta `> [!IMPORTANT]` en la cabecera del `README.md` de `v2.0` indicando el enlace temporal de pruebas en GitHub Pages (`pfelipm.github.io/imgtools`) mientras `imgtools.pablofelip.online` mantiene la `v1.0` estable.
  - **Fase 2 — Corte definitivo a producción en GitHub Pages (retirada de Google Sites):**
    1. Completadas las pruebas de `v2.0`, fusionar `v2.0` en `main` (**Release `v2.0.0`**), cambiar la fuente de GitHub Pages a `main` y añadir el archivo `CNAME` con `imgtools.pablofelip.online`.
    2. Apuntar el registro DNS `CNAME` del subdominio `imgtools` directamente a `pfelipm.github.io` y activar *Enforce HTTPS*, eliminando definitivamente las restricciones del `<iframe>` de Google Sites (`sandbox` en portapapeles, descargas, `localStorage` y registro de PWA) sin cambiar la URL pública.

- [x] **Conversión en Progressive Web App (PWA) 100% *Offline*, fijado de versiones CDN y SRI** *(implementado en `v2.0.0-beta.5`; Tailwind v3.4.17 compilado en línea sin dependencias CDN externas; SRI se aplicará a `JSZip` si se incorpora en `beta.6`)*
  - **Ubicación:** `index.html` (Tailwind Play CDN en línea ~9, Google Fonts en línea ~23 y miniatura remota de Google Drive en `#infoModal`, línea ~390).
  - **Problema:** `README.md` (línea ~97) indica que descargar `index.html` permite usarlo en local sin dependencias, pero sin conexión a internet el script `https://cdn.tailwindcss.com` no carga y toda la maquetación se rompe (además de emitir aviso en consola por no estar pensado para producción).
  - **Solución propuesta (alineada con `v2.0` de *PDF Tools (SPA)*):**
    - Añadir `manifest.json`, juego de iconos en `icons/`, botón `#pwa-install-btn` y Service Worker (`sw.js` con estrategia *Cache-First* y aviso no intrusivo de nueva versión disponible `#pwa-update-toast`) para uso 100% *offline*, instalación como app de escritorio/móvil y soporte opcional de *Web Share Target*.
    - Fijar versión explícita en scripts externos (p. ej. `https://cdn.tailwindcss.com/3.4.17` con `referrerpolicy="no-referrer"`, o bien CSS de Tailwind compilado e incrustado en `<style>` para que incluso abrir `index.html` suelto funcione sin red; y hashes `integrity="sha384-..."` + `crossorigin="anonymous"` si se incorpora `JSZip`), añadir `onerror="this.style.display='none'"` (o imagen WebP local) en el avatar de `#infoModal` y definir una pila tipográfica local de respaldo (`Inter, system-ui, -apple-system, sans-serif`) sin bloqueo por Google Fonts.

- [ ] **Prueba automática de humo con Playwright en GitHub Actions**
  - Siguiendo el patrón implantado en *Arquitecto Simple UML*, añadir un flujo ligero en `.github/workflows/` que abra `index.html` en Chromium *headless*, cargue imágenes sintéticas de prueba (incluyendo un SVG solo con `viewBox`) y verifique: ausencia de errores en consola, resolución exacta `1920×1080` en *Modo BalBino*, suma exacta de anchos en `getNLSSlices()`, generación válida de `Blob` WebP/PNG/JPG y empaquetado `.zip` en modo *batch*.

---

## 6. Documentación y Repositorio

- [x] **Optimizar el peso de `assets/ajuste-inteligente.gif` (`54 MB` → `~2–4 MB`) y limpiar archivos huérfanos en `assets/`** *(implementado en `v2.0.0-beta.5`: reducido a `~3,5 MB` y eliminados los 8 archivos no referenciados)*
  - **Situación actual:** La carpeta `assets/` ocupa **64 MB**, de los cuales `assets/ajuste-inteligente.gif` supone **54 MB** (~84% del total), superando el umbral de recomendación de 50 MB de GitHub y ralentizando o bloqueando su carga a través del proxy `camo.githubusercontent.com` en el `README.md`.
  - **Archivos no referenciados detectados:** `imgtools-interface.png`, `imgtools-interface-2026-04-13.png`, `imgtools-interface-02-2026-05-01.png`, `destacado HQ.png`, `destacado TIC_TOOLS (LQ).png`, `favicon.png`, `logo.png` y `ajuste-inteligente.mp4` no se enlazan ni desde `README.md` ni desde `index.html`.
  - **Solución propuesta:** Regenerar `ajuste-inteligente.gif` con paleta adaptativa (`ffmpeg palettegen/paletteuse`, `800–960 px`, `12–15 fps`, al igual que se redujo `demo.gif` de `15,7 MB` a `2,3 MB` en *PDF Tools*) y retirar del árbol principal los recursos antiguos que no se utilicen externamente.

- [x] **Sincronizar `README.md` con las capacidades reales y futuras** *(implementado en `v2.0.0-beta.5`)*
  - Ajustar o implementar las menciones actuales a *"Información en tiempo real"*, *"cualquier etiqueta de valor"* y uso local sin dependencias de red, y documentar la lista completa de ratios disponibles (`16:10` y `21:10` ya existen en el código pero no figuran en `README.md`, línea ~40).

---

## Ideas Evaluadas y Descartadas

- **Carga de imágenes mediante URL externa:** Descartada porque en una arquitectura 100% *client-side* la gran mayoría de servidores externos no envían cabeceras **CORS** permisivas, lo que marca el `<canvas>` como *tainted* e impide exportar con `toBlob()` / `toDataURL()`. Evitarlo exigiría un proxy intermedio que rompería la privacidad local.
- **Eliminación automática de fondo o reescalado con modelos de IA en cliente (WASM / WebGPU):** Descartada para el núcleo de ImgTools porque obliga a descargar modelos de `40–150 MB`, desvirtuando la inmediatez de herramienta ultraligera de un clic.
- ***Seam Carving* completo (*Liquid Rescale*) por programación dinámica:** Evaluado frente al motor actual de **Adaptación No Lineal (ANL)** por rebanadas paramétricas; descartado porque en 2K/4K resulta costoso en JS sin WebGL y tiende a quebrar líneas rectas o deformar rostros en fondos con textura, mientras que ANL rinde a 60 fps en tiempo real y ofrece control directo y predecible mediante la zona segura.
