# 🌌 AstroSentinel — Asteroid Threat Analysis System

[![Python](https://img.shields.io/badge/Python-3.9+-blue?style=flat&logo=python)](https://python.org)
[![Flask](https://img.shields.io/badge/Framework-Flask-black?style=flat&logo=flask)](https://flask.palletsprojects.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat)](LICENSE)
[![NASA Space Apps 2025](https://img.shields.io/badge/NASA_Space_Apps-2025-0B3D91?style=flat)](https://www.spaceappschallenge.org)

> An AI-powered web application that classifies asteroids and predicts their threat level using machine learning models trained on NASA JPL catalog data — with real-time IoT integration.

---

## 🎯 Overview

AstroSentinel takes orbital parameters of a near-Earth asteroid as input and delivers:

- **Classification** — Is it a Potentially Hazardous Asteroid (PHA)?
- **Diameter prediction** — Estimated size in meters/km with error margin
- **Threat level** — 6-tier scale from NULO to EXTINCION
- **PDF report** — Downloadable analysis report
- **IoT alert** — Real-time signal to a Particle Photon device and Ubidots dashboard

---

## ⚙️ How It Works

The system implements an end-to-end data pipeline:

1. **Extract** — User inputs orbital parameters (eccentricity, semi-major axis, inclination, albedo, etc.)
2. **Transform** — Parameters are structured into a Pandas DataFrame and scaled using a pre-fitted StandardScaler
3. **Load & Predict** — Scaled data is fed into two scikit-learn models:
   - A **regression model** predicts asteroid diameter
   - A **classification model** predicts PHA status (dangerous vs. safe)
4. **Output** — Results are returned via REST API and simultaneously pushed to IoT devices

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, Flask |
| Data & ML | Pandas, NumPy, scikit-learn, joblib |
| IoT Integration | Particle Photon (via Particle Cloud API), Ubidots |
| Report Generation | fpdf2 |
| Data Source | NASA JPL Small-Body Database |

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/analizar` | Analyze asteroid parameters → returns full prediction |
| POST | `/api/pdf` | Generate and download PDF report |
| GET | `/api/photon/scan` | Simulate a Particle Photon sensor scan |
| GET | `/api/photon/status` | Check IoT device connectivity |
| POST | `/api/photon/trigger` | Manually trigger threat level on hardware |
| GET | `/api/stats` | System statistics and model info |

---

## 🚀 Run Locally

**1. Clone the repository**
```bash
git clone https://github.com/mirandaEN/astrosentinel.git
cd astrosentinel
```

**2. Install dependencies**
```bash
pip install -r requirements.txt
```

**3. Run the app**
```bash
python app.py
```

The app will be available at `http://localhost:8080`

> **Note:** ML model files (`modelo_clasificacion_asteroides.pkl`, `escalador_clasificacion.pkl`, `modelo_regresion_asteroides.pkl`, `escalador_regresion.pkl`) must be present in the root directory. Without them, the app falls back to formula-based estimation.

---

## 🏆 Context

Built for the **NASA International Space Apps Challenge 2025** (October 4–5, 2025).
Received the **Galactic Problem Solver** recognition from NASA.

---

## 📁 Project Structure

```
astrosentinel/
├── app.py                          # Main Flask application
├── modelo_clasificacion_*.pkl      # Classification model + scaler
├── modelo_regresion_*.pkl          # Regression model + scaler
├── templates/
│   └── index.html                  # Frontend dashboard
├── requirements.txt
└── README.md
```

---

## 👩‍💻 Author

**Miranda Estefania Estrada Neyra**
Computer Systems Engineering — Instituto Tecnológico de Saltillo
[github.com/mirandaEN](https://github.com/mirandaEN)
