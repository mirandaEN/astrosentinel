from flask import Flask, request, jsonify, send_file, render_template
from flask_cors import CORS
import joblib
import pandas as pd
import numpy as np
from fpdf import FPDF
import os
import random
import time
import math
import requests as http_req

app = Flask(__name__)
CORS(app)

# ── Credenciales IoT ──────────────────────────────────────────
PARTICLE_DEVICE_ID   = "YOUR_PARTICLE_DEVICE_ID"
PARTICLE_ACCESS_TOKEN = "YOUR_PARTICLE_ACCESS_TOKEN"

UBIDOTS_TOKEN  = "YOUR_UBIDOTS_TOKEN"
UBIDOTS_DEVICE = "astrosentinel"


def publicar_particle(nivel_str: str, nivel_num: int) -> dict:
    """Llama directamente la función 'simularNivel' del Particle Photon.
       Este método es más confiable que publicar eventos: da respuesta inmediata
       con return_value = 1 si el Photon ejecutó la función correctamente.
    """
    url = f"https://api.particle.io/v1/devices/{PARTICLE_DEVICE_ID}/simularNivel"
    payload = {
        "arg":          nivel_str,          # se pasa como argumento a simularNivel()
        "access_token": PARTICLE_ACCESS_TOKEN
    }
    try:
        r = http_req.post(url, data=payload, timeout=8)
        body = r.json() if r.headers.get("content-type","").startswith("application/json") else {}
        ret  = body.get("return_value", -1)
        ok   = r.status_code == 200 and ret == 1
        print(f"[PARTICLE] simularNivel('{nivel_str}') → HTTP {r.status_code}  return_value={ret}  {'✅' if ok else '❌'}")
        return {"ok": ok, "status": r.status_code, "return_value": ret}
    except Exception as exc:
        print(f"[PARTICLE] Error: {exc}")
        return {"ok": False, "error": str(exc)}


def publicar_ubidots(nivel_num: int) -> dict:
    """Envía nivel numérico a Ubidots. Cuando nivel=5 el evento de Ubidots dispara la llamada."""
    if UBIDOTS_TOKEN == "BBUS-TU_TOKEN_AQUI":
        return {"ok": False, "skip": True, "msg": "Token Ubidots no configurado"}
    url = f"https://industrial.api.ubidots.com/api/v1.6/devices/{UBIDOTS_DEVICE}/"
    payload  = {"nivel_amenaza": {"value": nivel_num}}
    headers  = {"X-Auth-Token": UBIDOTS_TOKEN, "Content-Type": "application/json"}
    try:
        r = http_req.post(url, json=payload, headers=headers, timeout=5)
        ok = r.status_code in (200, 201)
        print(f"[UBIDOTS]  nivel_amenaza={nivel_num} → HTTP {r.status_code} {'✅' if ok else '❌'}")
        return {"ok": ok, "status": r.status_code}
    except Exception as exc:
        print(f"[UBIDOTS]  Error: {exc}")
        return {"ok": False, "error": str(exc)}

#  Cargar modelos
BASE = os.path.dirname(__file__)

def load_model(name):
    path = os.path.join(BASE, name)
    if os.path.exists(path):
        return joblib.load(path)
    return None

modelo_clasificacion   = load_model('modelo_clasificacion_asteroides.pkl')
escalador_clasificacion = load_model('escalador_clasificacion.pkl')
modelo_regresion       = load_model('modelo_regresion_asteroides.pkl')
escalador_regresion    = load_model('escalador_regresion.pkl')

MAE_REGRESION = 4.67

# Hacemos un diccionario de features para cada modelo para evitar errores de orden o columnas faltantes
FEATURES_CLASIFICACION = ['spkid', 'H', 'diameter_m', 'diameter_is_estimated',
                        'size_category', 'albedo', 'rot_per',
                        'e', 'a', 'i', 'q', 'n',
                        'class_APO', 'class_ATE', 'class_IEO']


FEATURES_REGRESION = ['spkid', 'pha', 'H', 'diameter_is_estimated',
                    'albedo', 'rot_per', 'e', 'a', 'i', 'q', 'n',
                    'class_APO', 'class_ATE', 'class_IEO']

SPKID_MEAN = 28527380

def obtener_nivel_amenaza(es_peligroso, diametro_m, moid_au):
    if es_peligroso and diametro_m > 1000:
        return "EXTINCION", 5
    if es_peligroso and diametro_m > 300:
        return "CRITICO", 4
    if es_peligroso and diametro_m > 140:
        return "ALTO", 3
    if es_peligroso or (moid_au < 0.05 and diametro_m > 50):
        return "MODERADO", 2
    if diametro_m > 100:
        return "BAJO", 1
    return "NULO", 0

def obtener_recomendacion(es_peligroso, diametro_m, moid_au, nivel):
    nivel_str, _ = nivel
    recomendaciones = {
        "EXTINCION": {
            "titulo": "NIVEL EXTINCION MASIVA - SE ACABO EL PLANETA",
            "acciones": [
                "Llamar a los Avengers de inmediato. Si no contestan, mandar paloma mensajera a Wakanda.",
                "Contactar a Goku para que cargue un Kamehameha desde orbita. El Super Saiyajin 3 deberia ser suficiente.",
                "Activar el Arca de Noe 2.0. Esta vez con WiFi y Netflix para el viaje.",
                "Llamar a Bruce Willis. El ya sabe que hacer, lo hizo en 1998 y funciono.",
                "Si todo lo anterior falla: poner buena musica, sacar las botanas y disfrutar el espectaculo."
            ],
            "color": "#ff0000"
        },
        "CRITICO": {
            "titulo": "ALERTA CRITICA - SITUACION MUY PREOCUPANTE",
            "acciones": [
                "Marcar al numero de Thor en el celular. Si no responde, intentar con Iron Man o al menos con Hawkeye.",
                "Construir urgentemente una catapulta gigante apuntando al espacio. La ciencia dira que no funciona, pero hay que intentarlo.",
                "Enviar una carta muy seria a la NASA firmada con caligrafía elegante. Eso siempre impresiona.",
                "Mandar al asteroide un playlist de reggaeton a todo volumen. Nadie aguanta eso, ni los asteroides.",
                "Establecer ventana de lanzamiento optima. O ventana de escape. Preferentemente la segunda."
            ],
            "color": "#ff4500"
        },
        "ALTO": {
            "titulo": "ADVERTENCIA - OBJETO POTENCIALMENTE PELIGROSO",
            "acciones": [
                "Asignar telescopios para monitoreo. Tambien binoculares si no hay presupuesto.",
                "Calcular trayectoria exacta. Si las matematicas no dan bien, recalcular con calculadora de $15 pesos.",
                "Notificar al vecino que tiene el jardin mas grande por si se necesita un campo de aterrizaje de emergencia.",
                "Preparar informe tecnico para las autoridades. Usar muchos graficos para que se vea profesional.",
                "Coordinar con el grupo de WhatsApp familiar. Ellos siempre saben que hacer en crisis."
            ],
            "color": "#ff8c00"
        },
        "MODERADO": {
            "titulo": "OBJETO EN MONITOREO - OJO CON ESTE",
            "acciones": [
                "Seguimiento mensual obligatorio. Ponerle una alarma en el celular para no olvidar.",
                "Analizar composicion del asteroide. Si es de oro, cambiar el plan de deflexion por uno de captura.",
                "Publicar en redes sociales para que la comunidad ayude a vigilarlo. Los astrofisicos de Twitter son muy activos.",
                "Evaluar si vale la pena mandarle una tarjeta de Navidad. Hay que mantener buena relacion con los vecinos del sistema solar."
            ],
            "color": "#ffd700"
        },
        "BAJO": {
            "titulo": "RIESGO BAJO - PERO AHI ESTA",
            "acciones": [
                "Catalogar en la base de datos oficial. Y tambien ponerle un apodo simpatico entre el equipo.",
                "Ideal para selfies telescopicas. Contenido unico para el Instagram del observatorio.",
                "Monitoreo semestral. Aprovechar para revisar si el telescopio necesita limpieza.",
                "Considerar ponerle nombre al asteroide. Algo epico como 'El Señor de las Rocas' o 'Pedro'."
            ],
            "color": "#00bfff"
        },
        "NULO": {
            "titulo": "SIN RIESGO - ESTE NO NOS HACE NADA",
            "acciones": [
                "Registrar en la base de datos y olvidarse de el. Hay asteroides mas interesantes por ahi.",
                "Usarlo como ejemplo en clases de astronomia. 'Este es un asteroide aburrido, tomen nota'.",
                "Revision rutinaria en 5 años. Para entonces probablemente ya nadie se acuerde de el."
            ],
            "color": "#00ff88"
        }
    }
    return recomendaciones.get(nivel_str, recomendaciones["NULO"])


def safe_text(s):
    """Reemplaza caracteres unicode no soportados por fpdf2 con fuentes básicas."""
    return (str(s)
            .replace('—', '-').replace('–', '-')
            .replace('’', "'").replace('‘', "'")
            .replace('“', '"').replace('”', '"')
            .replace('≥', '>=').replace('×', 'x')
            .replace('±', '+/-').replace('°', 'deg')
            .encode('latin-1', errors='replace').decode('latin-1'))

def crear_pdf(datos):
    """Genera PDF estilizado con los resultados del análisis."""
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # Header
    pdf.set_fill_color(5, 5, 20)
    pdf.rect(0, 0, 210, 297, 'F')
    pdf.set_text_color(0, 200, 255)
    pdf.set_font("Arial", 'B', 22)
    pdf.cell(0, 15, "REPORTE DE ANALISIS DE ASTEROIDE", ln=True, align='C')
    pdf.set_font("Arial", size=10)
    pdf.set_text_color(150, 150, 180)
    pdf.cell(0, 8, safe_text(f"Generado por AstroSentinel IA - {time.strftime('%d/%m/%Y %H:%M:%S')}"), ln=True, align='C')
    pdf.ln(5)

    # Divider
    pdf.set_draw_color(0, 200, 255)
    pdf.set_line_width(0.5)
    pdf.line(15, pdf.get_y(), 195, pdf.get_y())
    pdf.ln(8)

    nivel = datos['nivel_amenaza']
    colores = {"EXTINCION":(255,0,0),"CRITICO":(255,69,0),"ALTO":(255,140,0),
            "MODERADO":(255,215,0),"BAJO":(0,191,255),"NULO":(0,255,136)}
    r, g, b = colores.get(nivel, (0,200,255))

    pdf.set_fill_color(r, g, b)
    pdf.set_text_color(5, 5, 20)
    pdf.set_font("Arial", 'B', 16)
    pdf.cell(0, 12, safe_text(f"  NIVEL DE AMENAZA: {nivel}"), ln=True, fill=True, align='C')
    pdf.ln(6)

    pdf.set_text_color(200, 220, 255)
    pdf.set_font("Arial", 'B', 13)
    pdf.cell(0, 10, "RESULTADOS DEL ANALISIS", ln=True)
    pdf.set_line_width(0.3)
    pdf.set_draw_color(0, 200, 255)
    pdf.line(15, pdf.get_y(), 195, pdf.get_y())
    pdf.ln(4)

    pdf.set_font("Arial", size=11)
    pha_text = "SI - ASTEROIDE POTENCIALMENTE PELIGROSO (PHA)" if datos['es_peligroso'] else "NO - Objeto sin riesgo de impacto"
    pdf.set_text_color(r, g, b)
    pdf.cell(80, 8, "Clasificacion de amenaza:", ln=False)
    pdf.set_text_color(200, 220, 255)
    pdf.cell(0, 8, safe_text(pha_text), ln=True)

    pdf.set_text_color(0, 200, 255)
    pdf.cell(80, 8, "Diametro estimado:", ln=False)
    pdf.set_text_color(200, 220, 255)
    pdf.cell(0, 8, safe_text(f"{datos['diametro_m']} m  ({round(datos['diametro_m']/1000,3)} km)"), ln=True)

    pdf.set_text_color(0, 200, 255)
    pdf.cell(80, 8, "Rango de diametro (+/-MAE):", ln=False)
    pdf.set_text_color(200, 220, 255)
    pdf.cell(0, 8, safe_text(f"{datos['rango_inf']} m - {datos['rango_sup']} m"), ln=True)

    pdf.set_text_color(0, 200, 255)
    pdf.cell(80, 8, "MOID:", ln=False)
    pdf.set_text_color(200, 220, 255)
    pdf.cell(0, 8, safe_text(f"{datos.get('moid_au', 'N/A')} AU"), ln=True)
    pdf.ln(6)

    pdf.set_text_color(200, 220, 255)
    pdf.set_font("Arial", 'B', 13)
    pdf.cell(0, 10, "PARAMETROS ORBITALES INGRESADOS", ln=True)
    pdf.line(15, pdf.get_y(), 195, pdf.get_y())
    pdf.ln(4)
    pdf.set_font("Arial", size=10)

    params = datos.get('parametros', {})
    labels = {
        'H':       'Magnitud Absoluta (H)',
        'albedo':  'Albedo',
        'rot_per': 'Periodo de Rotacion (horas)',
        'e':       'Excentricidad',
        'a':       'Semieje Mayor (AU)',
        'i':       'Inclinacion (grados)',
        'q':       'Perihelio (AU)',
        'n':       'Movimiento Medio (grados/dia)',
        'clase':   'Clase Orbital',
        'diameter_is_estimated': 'Diametro Estimado'
    }
    for key, label in labels.items():
        val = params.get(key, 'N/A')
        pdf.set_text_color(0, 180, 220)
        pdf.cell(90, 7, safe_text(f"  {label}:"), ln=False)
        pdf.set_text_color(200, 220, 255)
        pdf.cell(0, 7, safe_text(str(val)), ln=True)
    pdf.ln(6)

    rec = datos.get('recomendacion', {})
    pdf.set_text_color(200, 220, 255)
    pdf.set_font("Arial", 'B', 13)
    pdf.cell(0, 10, "RECOMENDACIONES ESTRATEGICAS", ln=True)
    pdf.line(15, pdf.get_y(), 195, pdf.get_y())
    pdf.ln(4)

    pdf.set_fill_color(r, g, b)
    pdf.set_text_color(5, 5, 20)
    pdf.set_font("Arial", 'B', 11)
    pdf.cell(0, 9, safe_text(f"  {rec.get('titulo','')}"), ln=True, fill=True)
    pdf.ln(3)

    pdf.set_font("Arial", size=10)
    for i, accion in enumerate(rec.get('acciones', []), 1):
        pdf.set_text_color(0, 200, 255)
        pdf.cell(8, 7, f"{i}.", ln=False)
        pdf.set_text_color(200, 220, 255)
        pdf.multi_cell(0, 7, safe_text(accion))
        pdf.ln(1)

    pdf.ln(5)
    pdf.set_draw_color(0, 200, 255)
    pdf.line(15, pdf.get_y(), 195, pdf.get_y())
    pdf.ln(3)
    pdf.set_font("Arial", 'I', 8)
    pdf.set_text_color(100, 120, 160)
    pdf.multi_cell(0, 5, safe_text(
        "Reporte generado por AstroSentinel IA usando modelos de machine learning entrenados con datos del catalogo NASA JPL. "
        "Para evaluaciones oficiales de amenazas, consultar el Centro de Estudios de Objetos Cercanos a la Tierra (CNEOS) de NASA. "
        "Esta herramienta es de uso educativo y de investigacion academica."))

    ruta = os.path.join(BASE, "reporte_asteroide.pdf")
    pdf.output(ruta)
    return ruta


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/analizar', methods=['POST'])
def analizar():
    try:
        data = request.get_json()

        H       = float(data.get('H', 20))
        albedo  = float(data.get('albedo', 0.15)) or 0.15
        rot_per = float(data.get('rot_per', 17.25))
        e       = float(data.get('e', 0.35))
        a       = float(data.get('a', 1.5))
        i       = float(data.get('i', 12.0))
        q       = float(data.get('q', a * (1 - e)))
        n       = float(data.get('n', 0.9856 / (a ** 1.5)))
        clase   = data.get('clase', 'AMO')  # AMO/APO/ATE/IEO
        diam_estimado = int(data.get('diameter_is_estimated', 1))

        class_APO = 1 if clase == 'APO' else 0
        class_ATE = 1 if clase == 'ATE' else 0
        class_IEO = 1 if clase == 'IEO' else 0

        if modelo_regresion and escalador_regresion:
            row_reg = {'spkid': SPKID_MEAN, 'pha': 0, 'H': H,
                    'diameter_is_estimated': diam_estimado,
                    'albedo': albedo, 'rot_per': rot_per,
                    'e': e, 'a': a, 'i': i, 'q': q, 'n': n,
                    'class_APO': class_APO, 'class_ATE': class_ATE, 'class_IEO': class_IEO}
            df_reg = pd.DataFrame([row_reg])[FEATURES_REGRESION]
            x_reg  = escalador_regresion.transform(df_reg)
            diametro = round(float(modelo_regresion.predict(x_reg)[0]), 2)
        else:
            diametro = round(1329000 * (albedo ** -0.5) * (10 ** (-0.2 * H)), 2)

        diametro = max(0.1, diametro)

        if diametro < 25:
            size_cat = 0
        elif diametro < 140:
            size_cat = 1
        elif diametro < 1000:
            size_cat = 2
        else:
            size_cat = 3

        if modelo_clasificacion and escalador_clasificacion:
            row_clf = {'spkid': SPKID_MEAN, 'H': H, 'diameter_m': diametro,
                    'diameter_is_estimated': diam_estimado,
                    'size_category': size_cat,
                    'albedo': albedo, 'rot_per': rot_per,
                    'e': e, 'a': a, 'i': i, 'q': q, 'n': n,
                    'class_APO': class_APO, 'class_ATE': class_ATE, 'class_IEO': class_IEO}
            df_clf = pd.DataFrame([row_clf])[FEATURES_CLASIFICACION]
            x_clf  = escalador_clasificacion.transform(df_clf)
            pha_pred = int(modelo_clasificacion.predict(x_clf)[0])
            es_peligroso = bool(pha_pred)
            try:
                proba = float(modelo_clasificacion.predict_proba(x_clf)[0][1])
            except Exception:
                proba = 1.0 if es_peligroso else 0.0
        else:
            es_peligroso = (diametro >= 140 and q < 1.3)
            proba = 0.85 if es_peligroso else 0.05
            pha_pred = 1 if es_peligroso else 0

        if modelo_regresion and escalador_regresion:
            row_reg2 = {'spkid': SPKID_MEAN, 'pha': pha_pred, 'H': H,
                        'diameter_is_estimated': diam_estimado,
                        'albedo': albedo, 'rot_per': rot_per,
                        'e': e, 'a': a, 'i': i, 'q': q, 'n': n,
                        'class_APO': class_APO, 'class_ATE': class_ATE, 'class_IEO': class_IEO}
            df_reg2 = pd.DataFrame([row_reg2])[FEATURES_REGRESION]
            x_reg2  = escalador_regresion.transform(df_reg2)
            diametro = round(float(modelo_regresion.predict(x_reg2)[0]), 2)
            diametro = max(0.1, diametro)

        nivel = obtener_nivel_amenaza(es_peligroso, diametro, q)
        recomendacion = obtener_recomendacion(es_peligroso, diametro, q, nivel)

        params_display = {
            'H': H, 'albedo': albedo, 'rot_per': rot_per,
            'e': e, 'a': a, 'i': i, 'q': q, 'n': n,
            'clase': clase, 'diameter_is_estimated': diam_estimado
        }

        # ── Integración IoT: publicar siempre al Photon y a Ubidots ──
        particle_result = publicar_particle(nivel[0], nivel[1])
        ubidots_result  = publicar_ubidots(nivel[1])

        return jsonify({
            "es_peligroso": es_peligroso,
            "probabilidad_pha": round(proba * 100, 1),
            "diametro_m": diametro,
            "diametro_km": round(diametro / 1000, 4),
            "rango_inf": round(max(0, diametro - MAE_REGRESION), 2),
            "rango_sup": round(diametro + MAE_REGRESION, 2),
            "nivel_amenaza": nivel[0],
            "nivel_num": nivel[1],
            "recomendacion": recomendacion,
            "parametros": params_display,
            "iot": {
                "particle": particle_result,
                "ubidots":  ubidots_result
            }
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route('/api/pdf', methods=['POST'])
def generar_pdf():
    try:
        datos = request.get_json()
        ruta = crear_pdf(datos)
        return send_file(ruta, as_attachment=True,
                        download_name="AstroSentinel_Report.pdf",
                        mimetype='application/pdf')
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route('/api/photon/scan', methods=['GET'])
def photon_scan():
    """Simula un escaneo del sensor Particle Photon."""
    clases = ['AMO', 'APO', 'ATE', 'IEO']
    seed = int(time.time() * 1000) % 99999
    rng = random.Random(seed)

    H       = round(rng.uniform(14, 28), 2)
    albedo  = round(rng.uniform(0.04, 0.6), 3)
    rot_per = round(rng.uniform(2, 100), 2)
    e       = round(rng.uniform(0.05, 0.9), 4)
    a       = round(rng.uniform(0.5, 3.5), 4)
    i       = round(rng.uniform(0, 40), 2)
    q       = round(a * (1 - e), 4)
    n       = round(0.9856 / (a ** 1.5), 6)
    clase   = rng.choice(clases)
    diam_estimado = rng.choice([0, 1])

    diametro = round(1329000 * (albedo ** -0.5) * (10 ** (-0.2 * H)), 2)

    return jsonify({
        "device_id": "0a10aced202194944a0674bc",
        "firmware": "AstroSensor v2.3.1",
        "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ'),
        "sensor_status": "ONLINE",
        "scan_id": f"SCN-{seed:05d}",
        "parametros": {
            "H": H, "albedo": albedo, "rot_per": rot_per,
            "e": e, "a": a, "i": i, "q": q, "n": n,
            "clase": clase, "diameter_is_estimated": diam_estimado
        },
        "clase_orbital": clase,
        "diametro_estimado_m": diametro,
        "signal_strength": rng.randint(72, 99),
        "distance_sensor_m": round(rng.uniform(0.5, 25.0), 2)
    })


@app.route('/api/photon/status', methods=['GET'])
def photon_status():
    """Consulta si el Particle Photon está online."""
    url = f"https://api.particle.io/v1/devices/{PARTICLE_DEVICE_ID}"
    headers = {"Authorization": f"Bearer {PARTICLE_ACCESS_TOKEN}"}
    try:
        r = http_req.get(url, headers=headers, timeout=5)
        if r.status_code == 200:
            d = r.json()
            return jsonify({
                "online": d.get("connected", False),
                "name": d.get("name", "AstroSensor"),
                "last_heard": d.get("last_heard", ""),
                "platform": d.get("platform_id", 32)
            })
        return jsonify({"online": False, "error": f"HTTP {r.status_code}"})
    except Exception as exc:
        return jsonify({"online": False, "error": str(exc)})


@app.route('/api/photon/trigger', methods=['POST'])
def photon_trigger():
    """Dispara manualmente un nivel al Photon (para pruebas)."""
    data   = request.get_json() or {}
    nivel  = data.get('nivel', 'NULO')
    niveles = {"EXTINCION":5,"CRITICO":4,"ALTO":3,"MODERADO":2,"BAJO":1,"NULO":0}
    num    = niveles.get(nivel.upper(), 0)
    pr = publicar_particle(nivel.upper(), num)
    ub = publicar_ubidots(num)
    return jsonify({"particle": pr, "ubidots": ub})


@app.route('/api/stats', methods=['GET'])
def stats():
    return jsonify({
        "modelos_cargados": modelo_clasificacion is not None,
        "total_asteroides_conocidos": 35162,
        "phas_conocidos": 2368,
        "ultimas_24h_escaneos": random.randint(142, 890),
        "modelo_clasificacion": type(modelo_clasificacion).__name__ if modelo_clasificacion else "Simulado",
        "modelo_regresion": type(modelo_regresion).__name__ if modelo_regresion else "Simulado",
        "mae_regresion": MAE_REGRESION
    })


if __name__ == '__main__':
    app.run(debug=True, port=8080)
