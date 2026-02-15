import os
import json
import bcrypt
import requests

from flask import (
    Flask, request, jsonify, redirect, render_template,
    url_for, send_from_directory
)
from flask_sqlalchemy import SQLAlchemy
from flask_login import (
    LoginManager, UserMixin, login_user, logout_user,
    login_required, current_user
)

def create_app():
    app = Flask(__name__)
    app.secret_key = os.getenv("SECRET_KEY", "dev-secret-change-me")

    # -------------------- Instance folder (robusto) --------------------
    # Usa ruta absoluta dentro de tu app (evita conflictos en Render)
    instance_path = os.path.join(app.root_path, "instance")

    # Si existe pero NO es directorio (archivo/symlink raro), lo eliminamos
    if os.path.exists(instance_path) and not os.path.isdir(instance_path):
        try:
            os.remove(instance_path)
        except Exception:
            # Fallback extremo: usa /tmp si no se puede borrar
            instance_path = "/tmp/instance"

    os.makedirs(instance_path, exist_ok=True)

    # -------------------- DB (Render-ready) --------------------
    db_url = os.getenv("DATABASE_URL")

    if db_url:
        # Render a veces entrega postgres://
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)

        # Fuerza psycopg v3
        if db_url.startswith("postgresql://") and "+psycopg" not in db_url:
            db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

        app.config["SQLALCHEMY_DATABASE_URI"] = db_url
    else:
        # Solo para desarrollo local (o fallback)
        sqlite_path = os.path.join(instance_path, "local.db")
        app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + sqlite_path

    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # -------------------- Extensions --------------------
    db = SQLAlchemy()
    db.init_app(app)

    login_manager = LoginManager()
    login_manager.login_view = "login"
    login_manager.init_app(app)

    # -------------------- Settings --------------------
    WORDS_PATH = os.getenv("WORDS_PATH", "words.json")
    GUEST_CODE = os.getenv("GUEST_CODE", "")
    ADMIN_KEY  = os.getenv("ADMIN_KEY", "")  # to activate users in production

    # -------------------- Models --------------------
    class User(UserMixin, db.Model):
        id = db.Column(db.Integer, primary_key=True)
        first_name = db.Column(db.String(80), nullable=False)
        last_name  = db.Column(db.String(80), nullable=False)
        username   = db.Column(db.String(80), unique=True, nullable=False)
        password_hash = db.Column(db.LargeBinary, nullable=False)
        grade      = db.Column(db.Integer, nullable=False)  # 1..7

        is_active  = db.Column(db.Boolean, default=False)   # active == allowed to use app
        is_guest   = db.Column(db.Boolean, default=False)

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))

    # -------------------- Helpers --------------------
    def load_words_for_grade(grade: int):
        try:
            with open(WORDS_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data.get(str(grade), [])
        except Exception:
            return []

    # -------------------- PWA / Manifest --------------------
    @app.get("/manifest.webmanifest")
    def manifest():
        return send_from_directory("static", "manifest.webmanifest")

    # -------------------- Pages --------------------
    @app.get("/")
    def home():
        return redirect(url_for("app_hub")) if current_user.is_authenticated else render_template("index.html")

    @app.get("/signup")
    def signup():
        return render_template("signup.html")

    @app.get("/login")
    def login():
        pending = request.args.get("pending")
        return render_template("login.html", pending=pending)

    @app.get("/app")
    @login_required
    def app_hub():
        return render_template("app.html", active=bool(current_user.is_active), grade=current_user.grade)

    @app.get("/study")
    @login_required
    def study():
        return render_template("study.html", active=bool(current_user.is_active), grade=current_user.grade)

    @app.get("/quest")
    @login_required
    def quest():
        return render_template("quest.html", active=bool(current_user.is_active), grade=current_user.grade)

    @app.get("/words")
    @login_required
    def words_page():
        return render_template("words.html", grade=current_user.grade)

    # -------------------- Auth --------------------
    @app.post("/auth/signup")
    def auth_signup():
        data = request.get_json(force=True)

        first = (data.get("first_name") or "").strip()
        last  = (data.get("last_name") or "").strip()
        username = (data.get("username") or "").strip().lower()
        password = (data.get("password") or "")
        grade = int(data.get("grade") or 0)

        is_guest = bool(data.get("is_guest"))
        guest_code = (data.get("guest_code") or "").strip()

        if not (first and last and username and password and 1 <= grade <= 7):
            return jsonify({"error": "Missing/invalid fields"}), 400

        if User.query.filter_by(username=username).first():
            return jsonify({"error": "Username already exists"}), 409

        pw_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())

        user = User(
            first_name=first,
            last_name=last,
            username=username,
            password_hash=pw_hash,
            grade=grade,
            is_active=False,
            is_guest=False
        )

        # Guest bypass (no payment)
        if is_guest:
            if not GUEST_CODE or guest_code != GUEST_CODE:
                return jsonify({"error": "Invalid guest code"}), 403
            user.is_active = True
            user.is_guest = True

        db.session.add(user)
        db.session.commit()

        if user.is_guest:
            return jsonify({"ok": True, "next": "/login"})

        return jsonify({
            "ok": True,
            "next": "/login?pending=1",
            "message": "Cuenta creada. Pendiente de activación por el administrador."
        })

    @app.post("/auth/login")
    def auth_login():
        data = request.get_json(force=True)
        username = (data.get("username") or "").strip().lower()
        password = (data.get("password") or "")

        user = User.query.filter_by(username=username).first()
        if not user:
            return jsonify({"error": "Invalid credentials"}), 401

        if not bcrypt.checkpw(password.encode("utf-8"), user.password_hash):
            return jsonify({"error": "Invalid credentials"}), 401

        login_user(user)
        return jsonify({"ok": True, "active": bool(user.is_active), "next": "/app"})

    @app.post("/auth/logout")
    @login_required
    def auth_logout():
        logout_user()
        return jsonify({"ok": True})

    # -------------------- Admin: Activate/Deactivate user --------------------
    @app.post("/admin/activate")
    def admin_activate():
        """
        Body: { "admin_key": "...", "username": "student", "active": true/false }
        Env: ADMIN_KEY must be set on Render.
        """
        if not ADMIN_KEY:
            return jsonify({"error": "Admin endpoint disabled"}), 404

        data = request.get_json(force=True)
        key = (data.get("admin_key") or "").strip()
        username = (data.get("username") or "").strip().lower()
        active = bool(data.get("active", True))

        if key != ADMIN_KEY:
            return jsonify({"error": "Unauthorized"}), 401
        if not username:
            return jsonify({"error": "Missing username"}), 400

        user = User.query.filter_by(username=username).first()
        if not user:
            return jsonify({"error": "User not found"}), 404

        user.is_active = active
        db.session.commit()
        return jsonify({"ok": True, "username": username, "active": bool(user.is_active)})

    # -------------------- Words API --------------------
    @app.get("/api/words")
    @login_required
    def api_words():
        if not current_user.is_active:
            return jsonify({"error": "Cuenta inactiva. Contacta al administrador para activación."}), 402
        words = load_words_for_grade(current_user.grade)
        return jsonify({"grade": current_user.grade, "count": len(words), "words": words})

    # -------------------- Translate + hint --------------------
    @app.post("/api/translate")
    @login_required
    def api_translate():
        if not current_user.is_active:
            return jsonify({"error": "Cuenta inactiva. Contacta al administrador para activación."}), 402

        data = request.get_json(force=True)
        text = (data.get("text") or "").strip()
        target = (data.get("target") or "es").strip()
        if not text:
            return jsonify({"error": "Missing text"}), 400

        url = "https://api.mymemory.translated.net/get"
        r = requests.get(url, params={"q": text, "langpair": f"en|{target}"}, timeout=15)
        if not r.ok:
            return jsonify({"error": "Translate failed"}), 502

        out = r.json()
        translated = (out.get("responseData") or {}).get("translatedText", "")
        return jsonify({"translated": translated})

    @app.post("/api/hint")
    @login_required
    def api_hint():
        if not current_user.is_active:
            return jsonify({"error": "Cuenta inactiva. Contacta al administrador para activación."}), 402

        data = request.get_json(force=True)
        word = (data.get("word") or "").strip()
        if not word:
            return jsonify({"error": "Missing word"}), 400

        if len(word) >= 3:
            masked = word[0] + ("_" * (len(word) - 2)) + word[-1]
        else:
            masked = "_" * len(word)

        return jsonify({"hint": f"Starts with '{word[:1]}', ends with '{word[-1:]}' • Pattern: {masked}"})

    # -------------------- Init DB --------------------
    with app.app_context():
        db.create_all()

    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(debug=True, host="0.0.0.0", port=port)
