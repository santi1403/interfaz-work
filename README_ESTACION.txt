ESTACION - Workstation Tablet - Modo Aplicacion
=============================================
Archivo: ESTACION.bat (doble clic para iniciar)
No modifica nada de tu codigo existente (index.html/js/api intactos).

Que hace:
1. Levanta el servidor PHP en 0.0.0.0:8000 (sirve para localhost y para la IP 192.168.10.111)
2. Abre http://localhost:8000 como ventana emergente tipo APP (--app de Chrome/Edge) sin barra de direcciones, parece aplicacion nativa/tablet.

Auto-inicio al prender la Workstation:
- Presiona Win+R -> escribe shell:startup -> Enter
- Copia el acceso directo de ESTACION.bat en esa carpeta
- Reinicia: al prender abrira solo la ventana en modo app.

Kiosk total (sin cerrar, pantalla completa tablet):
En ESTACION.bat cambia la linea de Chrome por:
  --app=http://localhost:8000 --kiosk --window-size=1920,1080

Si no tienes Chrome, usa Edge: ya viene por defecto.

Futuro (sin cambios ahora):
- Cuando la conectes a la Workstation real, solo cambia la IP en js/config.js:13 si la tablet tiene otra IP
- Para empaquetar como .exe real, luego podemos añadir Electron (main.js) sin tocar tu interfaz.
