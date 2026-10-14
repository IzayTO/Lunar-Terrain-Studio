# Lunar Terrain Studio 1.0.0

Editor independiente de terreno lunar para Sky Explorer. Todos los archivos de esta entrega están en la raíz. No requiere npm, compilación, cuentas adicionales ni conexiones a los juegos mientras editas. Three.js y la compresión ZIP vienen incluidos; no usa CDN en ejecución.

## 1. Publicarlo desde el iPhone

1. Descarga `Lunar-Terrain-Studio.zip`. En **Archivos → Descargas**, toca el ZIP para descomprimirlo y entra en la carpeta que crea iOS.
2. Abre GitHub en Safari. Crea un repositorio nuevo **público**, por ejemplo `Lunar-Terrain-Studio`. Puedes marcar «Add a README file» para inicializar `main`.
3. En el repositorio, pulsa **Add file → Upload files → choose your files**. En Archivos, entra en la carpeta descomprimida y selecciona **los archivos**, no la carpeta ni el ZIP. Sube todos y pulsa **Commit changes**. Si no aparece el botón, activa «Solicitar sitio web de escritorio» en Safari.
4. En **Settings → Pages**, elige **Deploy from a branch**, rama **main**, carpeta **/(root)** y pulsa **Save**.
5. Espera a que termine la publicación y abre el enlace que muestra GitHub. Si usaste el nombre anterior: `https://izayto.github.io/Lunar-Terrain-Studio/`.

`index.html`, `app.js`, `three.module.js`, `three.core.js`, `lunar-original.png` y el resto deben quedar directamente en la raíz. Abrir `index.html` desde Archivos no ejecuta una web con módulos: utiliza el enlace HTTPS de GitHub Pages.

## 2. Esculpir y guardar

- La primera carga muestra una copia exacta del PNG lunar compartido por VR y App.
- En teléfono, abre **Esculpir**, elige una herramienta y cierra el panel con **⌄** para dejar más espacio. Pulsa **Esculpir** en el selector flotante si estabas navegando.
- **Elevar / Hundir:** mantén presionado o arrastra. **Pincel** permite cambiar diámetro, fuerza, límite de altura, borde, elipse, rotación, estabilización y acumulación.
- **Suavizar:** repasa una zona para mezclar pendientes. **Nivelar:** escribe la altura objetivo o pulsa «Tomar altura del terreno» y toca un punto.
- **Contorno libre:** dibuja la forma y suelta. El contorno se cierra suavemente, excepto en Canal, que permanece abierto. Ajusta altura/profundidad, transición y, cuando corresponde, borde elevado o anchura. **Aplicar** conserva la vista previa; **Cancelar** la descarta. Los montículos y cráteres parten de tu contorno, no de un catálogo de formas predeterminadas.
- **Restaurar región:** repasa para recuperar gradualmente el original. **Proyecto → Restaurar original completo** recupera todo el mapa y se puede deshacer.
- **Nuevo:** permite comenzar con el original o con una superficie plana. Antes de iniciar uno nuevo, descarga el proyecto que quieras conservar.
- Los botones superiores **↶ / ↷ / × / ⌖** son Deshacer, Rehacer, Cancelar y Restablecer vista. El historial se limita aproximadamente a 64 MB y conserva el trazo más reciente; los pasos antiguos se descartan al superar ese límite. El proyecto descargado guarda el estado actual, no el historial de deshacer.
- **Proyecto → Guardar** descarga `nombre.lunar.zip` en iPhone. Este ZIP es el proyecto editable: vuelve a abrirlo con **Abrir** o **Importar proyecto**, sin descomprimirlo. **Guardar copia** descarga una copia con otro nombre. En navegadores de escritorio con acceso a archivos, Guardar puede actualizar el archivo seleccionado.
- Hay autoguardado en IndexedDB y un aviso para recuperarlo al volver. Es propio de ese navegador; puede perderse si borras los datos de Safari. La descarga del proyecto es la copia transportable.

El proyecto guarda alturas Float32, cámara, pincel, configuración del contorno, ciclo, referencia visual y sombras válidas. Puedes seguir editando aunque todavía tengas alturas fuera del rango PNG.

## 3. Navegar y visualizar

| Dispositivo | Acción |
|---|---|
| Teléfono / Navegar | Un dedo gira; dos dedos desplazan y hacen zoom |
| Teléfono / Esculpir | Un dedo esculpe; al entrar el segundo se revierte el trazo activo y empieza la navegación |
| Teléfono tras dos dedos | Levanta ambos antes de iniciar otro trazo |
| Ratón | Izquierdo esculpe; derecho gira; central desplaza; rueda hace zoom |
| Ratón con Mayúsculas | Izquierdo desplaza |
| Teclado | Ctrl/⌘ Z deshace; Ctrl/⌘ Shift Z o Ctrl Y rehace; Ctrl/⌘ S guarda |
| Teclado | Esc cancela; 0 restablece; F centra selección; N navega; B esculpe |
| Teclado | [ / ] cambian diámetro; flechas desplazan; + / − hacen zoom |

**Vista** incluye superior, lateral y orbital, centrar selección, cuadrícula de 100 m, límites e imagen de referencia con tamaño, posición y opacidad. La referencia se adapta a un máximo de 2048 píxeles para controlar el consumo de memoria. Las coordenadas y altura se leen al tocar o pasar el puntero.

El cuadrado interior de ±768 m señala la zona central detallada de los juegos; todo el mapa de ±2048 m es editable. El editor reduce triángulos a distancia, pero selecciona y modifica la rejilla completa. Las mallas y normales sólo se recalculan en las regiones afectadas.

La barra inferior muestra porcentaje del ciclo y fase terrestre. Usa reproducir/pausar o los botones −/+ para avanzar 0.5 %. En **Iluminación** cambia la velocidad. La fuente solar es invisible en todas las vistas. La trayectoria y el aporte terrestre son los del juego; el material del editor es deliberadamente sencillo y sin microtexturas.

## 4. Exportar el terreno a VR y App

1. En **Exportar**, pulsa **Exportar terreno PNG**.
2. Guarda `lunar-height.png` en Archivos. Si hay alturas fuera de −128 a +128 m, el editor las señala y permite ajustar escala vertical, desplazar cuando cabe o limitar explícitamente. Nunca las recorta sin que elijas una corrección.
3. En cada repositorio, sustituye el `lunar-height.png` de la raíz por este archivo, conservando exactamente su nombre.
4. **Recomendación para estas versiones:** usa el asistente del ZIP de integración incluso si sólo cambias el terreno. Los juegos tienen una caché offline con comprobación de huellas; el asistente prepara también el `service-worker.js` actualizado para que no quede el PNG antiguo en la app instalada.

No subas los archivos del editor sobre los juegos. No reemplaces `lunar-terrain.js`, `lunar-sky.js`, `app.js` ni los módulos Three.js de los juegos con archivos del editor.

## 5. Calcular y aprovechar las sombras

1. Guarda el proyecto y termina los trazos pendientes.
2. **Iluminación → Calcular sombras**. Elige 16 m, 8 m o 4 m por muestra. El cálculo recorre la trayectoria original en un worker, muestra progreso y permite cancelar. La cámara sigue funcionando.
3. Activa **Ver sombras precalculadas** para revisarlas. Cualquier cambio de terreno invalida el resultado.
4. **Exportar → Exportar paquete de sombras** descarga `Lunar-Sombras-Datos.zip`. También exporta el PNG del mismo estado del terreno.
5. Usa el ZIP separado `Lunar-Terrain-Studio-Integracion.zip`. Sus instrucciones y su asistente `instalar.html` preparan los reemplazos para cada juego. El asistente verifica que PNG y sombras pertenecen al mismo terreno.

El paquete de integración incluye sombras del **original** a 513² con 94 instantes. Sirven como ejemplo listo para ese terreno. Para tus modificaciones calcula y exporta un paquete nuevo.

El formato completo, la precisión del barrido, sus límites y la integración con la caché local se describen en **FORMATO-SOMBRAS.md**.

## Qué se verificó

- Fórmulas originales de ambos repositorios comparadas numéricamente en 4097 instantes.
- Las 1,050,625 muestras R/G del original sobreviven una exportación PNG sin cambiar un solo byte R/G; comprobación adicional con un decodificador PNG independiente.
- Esculpido, historial por regiones, cancelación, selección por triángulos, cinco variantes de contorno y rechazo de alturas fuera de rango.
- Worker real de precálculo completo y validación del contenedor de sombras.
- Generación de paquetes para VR y App, con y sin sombras, y verificación de todas las huellas de sus manifiestos offline.
- Los GLSL originales usados por la conversión WebGPU se mantienen idénticos.

**Límite de verificación:** no hubo navegador de pruebas disponible en este entorno. La interfaz, los shaders en una GPU real, los gestos de Safari y el funcionamiento en Meta Quest requieren una prueba en dispositivo; no se afirman FPS ni rendimiento medido en tu iPhone. Ver `VERIFICACION.json` para resultados de las pruebas de lógica y datos.

## Estructura y procedencia

- `terrain-core.js`: rejilla, pinceles, historial y selección exacta por triángulos.
- `view.js`: visualización Three.js, niveles de detalle y sombras en vivo.
- `controls.js`: navegación y separación de gestos.
- `solar.js`: contrato solar original.
- `terrain-worker.js`, `shadow-core.js`: contornos, precálculo, contenedores y muestreo.
- `file-io.js`: PNG RG, proyecto ZIP, guardado y autoguardado.
- `app.js`, `index.html`, `styles.css`: interfaz y coordinación.
- `ORIGEN.json`: commits y huellas de las fuentes revisadas el 13 de octubre de 2026.

Referencias: [Map-desing](https://github.com/IzayTO/Map-desing), [Sky Explorer VR](https://github.com/IzayTO/Sky-Explorer-VR), [Sky Explorer App](https://github.com/IzayTO/Sky-Explorer-App). Se estudiaron navegación, controles, paneles, selección y persistencia de Map-desing; no se reutilizaron sus herramientas de construcción. El PNG original y el contrato lunar proceden de los proyectos de Isai / IzayTO. Three.js y fflate mantienen sus licencias adjuntas. No se modificó ni publicó ninguno de los repositorios de referencia.
