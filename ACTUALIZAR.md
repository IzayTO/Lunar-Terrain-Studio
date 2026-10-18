# Tu taller lunar · versión 2.0

## Actualizar desde el iPhone

1. Antes de actualizar, abre el editor actual y pulsa **Proyecto → Guardar**. Conserva ese proyecto en Archivos.
2. Descarga y descomprime **Lunar-Terrain-Studio-2.0.zip**.
3. Abre tu repositorio **IzayTO/Lunar-Terrain-Studio**. En **Add file → Upload files**, selecciona todos los archivos de la descarga y confirma la sustitución de los que ya existen.
4. Los archivos van directamente en la raíz del repositorio. No subas el ZIP ni una carpeta. Tampoco borres los archivos del asistente de integración si ya los tienes allí.
5. Espera a que GitHub Pages termine de publicar y recarga tu página. Verás **LUNAR 02** arriba. Si aún aparece la versión anterior, cierra esa pestaña y abre de nuevo el enlace con `?v=2` al final.
6. Recupera el autoguardado o abre el proyecto que descargaste. Los proyectos de la versión anterior siguen siendo válidos.

Esta actualización corresponde únicamente al editor. No necesitas crear otro repositorio, volver a instalar el asistente ni modificar VR o App para usar estas herramientas.

## Ver el terreno a escala humana

1. Abre **Vista → Escala real** y activa persona, rover o panel.
2. Pulsa **Colocar en terreno**, toca junto a la zona que estás modelando y pulsa **Ver de cerca**.
3. Las figuras conservan su posición X/Z mientras esculpes. Sus pies se apoyan en el terreno. Puedes cambiar su giro y transparencia.
4. Ajusta **Ojos · m** a la altura que quieras comprobar. El valor inicial es **1,68 m**; la figura completa mide aproximadamente 1,80 m. En VR de pie, la cámara sigue la altura real del visor: no todos los jugadores miden lo mismo.

El rover es una silueta simplificada de aproximadamente **2,88 × 2,03 m**, con antena a **2,38 m**. El panel de pared mide **4 × 2,8 m**. Son referencias de tamaño, no copias detalladas de los modelos ni objetos para exportar.

En **Vista → Cuadrícula y límites** puedes alternar por separado:

- Cuadrícula métrica, desde 4 m hasta 250 m.
- Aparición: **X = 0, Z = 0**.
- Círculo explorable: **600 m de radio**.
- Zona central detallada: cuadrado de **±768 m**.
- Borde del mapa: **±2048 m**, un mundo de 4096 × 4096 m.

El círculo refleja el límite de desplazamiento revisado en los controles del juego. No representa un alcance de manos ni modifica sus reglas.

## Aplanar al pasar

Elige **Aplanar** en la barra sobre el terreno. Cambia la cota allí mismo; en **Ajustes** elige círculo, cuadrado o elipse y su tamaño.

En **Pincel → Cota del aplanador** puedes fijar una altura o tomar la del primer toque. La cota permanece fija durante todo ese trazo. El centro queda plano y el borde conserva una transición suave. Una zona que ya está a esa cota no cambia.

Para tomar otra altura usa **Tomar altura** o **Alt + clic** en escritorio. La rejilla tiene muestras cada 4 m: no está pensada para modelar escalones de centímetros.

## Copiar y pegar una forma

1. Pulsa **Área** y dibuja alrededor del relieve que quieras copiar. Suelta para cerrar la selección.
2. Pulsa **Copiar**. La selección original permanece intacta.
3. Prepara una superficie horizontal con **Aplanar**, suficientemente grande para toda la copia.
4. Pulsa **Pegar** y toca ese destino. La silueta de color es una vista previa: todavía no cambia las alturas.
5. Si hay desnivel, aparece en rojo y **Aplicar** queda desactivado. Se comprueban todas las muestras seleccionadas; la tolerancia es 2 cm para absorber la cuantización del PNG.
6. En **Esculpir → Copiar y colocar relieve**, ajusta el borde o gira la copia en pasos de 90°. Puedes tocar otra posición.
7. Pulsa **Aplicar** para conservarla o **Cancelar** para salir. Deshacer recupera el terreno anterior en un solo paso.

La copia conserva el relieve relativo a la altura mediana del contorno original y lo adapta a la cota del destino. La posición se ajusta a la rejilla de 4 m para conservar las muestras. La copia temporal no se guarda dentro del proyecto; la selección sí.

## Crear tus propios pinceles

1. Abre **Pincel → Huellas múltiples → Activar pincel compuesto**.
2. Arrastra los círculos del recuadro para distribuirlos. Añade o quita huellas, hasta 16.
3. Toca una huella para cambiar su tamaño, fuerza y comportamiento.
4. **Seguir herramienta activa** permite elevar o hundir todas esas huellas juntas. **Siempre elevar** o **Siempre hundir** crea combinaciones fijas: por ejemplo, un círculo grande que eleva y otro más pequeño que hunde en el centro.
5. Ajusta el tamaño general y prueba el pincel sobre el terreno. Los círculos de vista previa muestran todas las huellas; la distribución permanece estable al arrastrar.
6. Pulsa **Guardar pincel**, dale un nombre y elígelo después desde **Ajustes → Mi pincel**, junto al terreno.

Puedes guardar hasta 24 pinceles, exportarlos a JSON e importarlos en otro dispositivo. La colección también se conserva en el archivo del proyecto. Cada trazo, incluso con muchas huellas, cuenta como un único paso de Deshacer.

## Atajos y controles

| Acción | Atajo |
|---|---|
| Elevar / hundir / invertir | R / D / X |
| Suavizar / aplanar | S / L |
| Suavizar temporalmente | Mantener Shift mientras esculpes |
| Invertir temporalmente elevar/hundir | Mantener Ctrl o ⌘; no cambia huellas con comportamiento fijo |
| Tamaño | [ y ] o Ctrl/⌘ + rueda |
| Fuerza | Shift + [ y ] o Alt + rueda |
| Tomar altura | Alt + clic |
| Girar pincel / copia | Q y E |
| Contorno / área libre / punto | C / A / V |
| Copiar / pegar selección | Ctrl/⌘ C / V |
| Aplicar copia / cancelar | Enter / Esc |
| Quitar selección | Supr o Retroceso |
| Deshacer / rehacer | Ctrl/⌘ Z / Ctrl/⌘ Shift Z; también Ctrl Y |
| Navegar / esculpir | N / B |
| Superior / lateral / lateral desde X | 7 / 1 / 3 |
| Centrar selección / restablecer | F / 0 |
| Cuadrícula / figuras | G / H |
| Ocultar o mostrar panel | Tab |
| Guardar / guardar copia / abrir | Ctrl/⌘ S / Ctrl/⌘ Shift S / Ctrl/⌘ O |
| Mostrar ayuda | ? |

Con ratón: izquierdo trabaja, derecho gira, central desplaza, rueda acerca. **Espacio + arrastrar** también desplaza. Las teclas no interfieren con la edición de texto, salvo Guardar y Abrir.

Con los dedos: un dedo trabaja o navega según el modo, y dos dedos desplazan y acercan. Al entrar el segundo dedo se revierte el trazo activo; levanta ambos antes de dibujar de nuevo.

## Guardado y exportación

**Guardar** conserva tu proyecto editable, incluidas las nuevas referencias y pinceles. **Exportar terreno PNG** continúa generando exactamente el formato R/G de 1025 × 1025 de Sky Explorer. La iluminación y el cálculo de sombras mantienen el mismo ciclo. Las figuras, la cuadrícula y las selecciones son ayudas del editor: no se incorporan al PNG ni a las sombras.

Para llevar el terreno y las sombras a los juegos, utiliza el mismo asistente de integración de la entrega anterior. Esta actualización no añade archivos nuevos a VR ni App.

## Comprobaciones y límites

Se verificaron los algoritmos, la geometría de las referencias, los archivos de proyecto antiguos y nuevos, los gestos mediante eventos y la conexión de los controles a las operaciones reales. El barrido solar y la codificación R/G superan las pruebas de regresión. Consulta `VERIFICACION-2.json`.

La prueba de interfaz usa eventos y un renderizador simulado: no es una prueba visual en navegador. Quedan pendientes la revisión visual en Safari/iPhone y el rendimiento de la GPU de un dispositivo real.
