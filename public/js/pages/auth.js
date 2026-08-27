(() => {
  const params = new URLSearchParams(location.search);

  const safeNext = () => {
    const next = params.get("next") || "/";
    return next.startsWith("/") && !next.startsWith("//") ? next : "/";
  };

  const form =
    document.getElementById("login-form") || document.getElementById("register-form");
  if (!form) return;

  const msg = document.getElementById("auth-msg");
  const submitBtn = form.querySelector('button[type="submit"]');
  const emailInput = form.querySelector('input[name="email"]');

  const prefill = params.get("email");
  if (prefill && emailInput) emailInput.value = prefill;
  document.getElementById("to-register")?.setAttribute(
    "href",
    `/register.html${safeNext() !== "/" ? `?next=${encodeURIComponent(safeNext())}` : ""}`
  );
  document.getElementById("to-login")?.setAttribute(
    "href",
    `/login.html${safeNext() !== "/" ? `?next=${encodeURIComponent(safeNext())}` : ""}`
  );

  MV.bootPromise.then(() => {
    if (MV.user) location.replace("/account.html");
  });

  const setError = (text) => {
    msg.textContent = text;
    msg.className = text ? "form-msg err" : "form-msg";
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setError("");

    const isLogin = form.id === "login-form";
    const name = form.querySelector('input[name="name"]')?.value.trim() ?? "";
    const email = emailInput.value.trim().toLowerCase();
    const password = form.querySelector('input[name="password"]').value;

    if (!isLogin && name.length < 2) return setError("Please enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setError("Please enter a valid email address.");
    if (!isLogin && password.length < 8) return setError("Password must be at least 8 characters.");
    if (!password) return setError("Please enter your password.");

    submitBtn.disabled = true;
    submitBtn.textContent = isLogin ? "Signing In…" : "Creating Account…";

    try {
      const res = await MV.api.post(isLogin ? "/api/auth/login" : "/api/auth/register", {
        ...(isLogin ? {} : { name }),
        email,
        password,
      });
      let next = safeNext();
      if (res.user.role === "admin" && next === "/") next = "/admin/";
      location.replace(next);
    } catch (err) {
      setError(err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = isLogin ? "Sign In" : "Create Account";
    }
  });
})();
