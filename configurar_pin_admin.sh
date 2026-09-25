#!/bin/bash
echo "Vamos a configurar el PIN de acceso al panel de administración."
echo "Lo que escribas NO se va a ver en pantalla (es normal, es más seguro así)."
echo ""
read -s -p "Escribí el PIN nuevo y apretá Enter: " PIN
echo ""
read -s -p "Repetilo para confirmar: " PIN2
echo ""

if [ -z "$PIN" ]; then
  echo "❌ No escribiste nada. Corré el script de nuevo."
  exit 1
fi

if [ "$PIN" != "$PIN2" ]; then
  echo "❌ Los dos valores no coinciden. Corré el script de nuevo."
  exit 1
fi

echo "Guardando..."
supabase secrets set ADMIN_PIN="$PIN" --project-ref waevdcqdkovqaxkonlvj

echo ""
echo "✅ Listo. Tu PIN nuevo ya quedó guardado en el servidor."
