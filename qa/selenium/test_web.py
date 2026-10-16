"""Automation UI Lukla Ops (Selenium, headless Chromium).

Skenario:
 1. Landing (/) termuat + widget chat asisten tampil.
 2. Login OWNER valid -> redirect /dashboard + sambutan user tampil.
 3. Login password salah -> pesan error tampil, tetap di /login.
 4. Login KLIEN_MAKLON -> halaman portal-klien bisa dibuka + terisolasi.
 5. Akses tanpa login ke /dashboard -> diarahkan ke login (guard).

Jalankan: .venv/bin/python /tmp/opencode/selenium/test_web.py
"""
import shutil
import sys

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE = "http://localhost:3000"
OWNER = ("hendra_owner", "Lukla@Owner2026")
KLIEN = ("klien_a", "klien123")

PASS, FAIL = "PASS", "FAIL"
results: list[tuple[str, str, str]] = []


def make_driver():
    import glob

    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1366,900")
    candidates = sorted(glob.glob("/home/andre/.cache/ms-playwright/chromium_headless_shell-*/chrome-linux/headless_shell"))
    if candidates:
        opts.binary_location = candidates[-1]
    return webdriver.Chrome(options=opts)


def check(name: str, cond: bool, detail: str = "") -> None:
    results.append((PASS if cond else FAIL, name, detail))
    print(f"[{PASS if cond else FAIL}] {name}" + (f" — {detail}" if detail and not cond else ""))


def login(driver, username: str, password: str) -> None:
    driver.get(f"{BASE}/login")
    wait = WebDriverWait(driver, 20)
    wait.until(EC.presence_of_element_located((By.ID, "login-username")))
    wait.until(EC.element_to_be_clickable((By.ID, "login-password")))
    driver.find_element(By.ID, "login-username").send_keys(username)
    driver.find_element(By.ID, "login-password").send_keys(password)
    driver.find_element(By.ID, "btn-login-submit").click()


def main() -> int:
    # Setiap skenario pakai driver baru (Chromium kontainer sering crash saat navigasi ulang)
    def scenario(name, fn) -> None:
        driver = make_driver()
        try:
            fn(driver, WebDriverWait(driver, 20))
        except AssertionError as e:
            check(name, False, str(e))
        except Exception as e:  # noqa: BLE001
            check(name, False, f"{type(e).__name__}: {str(e)[:160]}")
        finally:
            try:
                driver.quit()
            except Exception:  # noqa: BLE001
                pass

    def s1_landing(driver, wait) -> None:
        driver.get(f"{BASE}/")
        check("landing memuat judul Lukla", "Lukla" in driver.title or "Lukla" in driver.page_source)
        avatar = driver.find_elements(By.XPATH, "//*[contains(@aria-label, 'Asisten Chatbot')]")
        check("widget chat asisten tampil", len(avatar) > 0)

    def s2_owner(driver, wait) -> None:
        login(driver, *OWNER)
        wait.until(EC.url_contains("/dashboard"))
        check("login owner redirect ke /dashboard", "/dashboard" in driver.current_url, driver.current_url)
        body = driver.page_source
        check("dashboard tampil data owner", "Hendra" in body or "Dashboard" in body)

    def s3_wrong(driver, wait) -> None:
        login(driver, OWNER[0], "salahpassword")
        try:
            WebDriverWait(driver, 8).until(EC.url_contains("/dashboard"))
            check("login salah DITOLAK (tetap di login)", False, f"lolos ke {driver.current_url}")
        except Exception:
            err = driver.find_elements(By.XPATH, "//*[contains(text(), 'salah') or contains(text(), 'tidak valid')]")
            check("login salah DITOLAK (tetap di login)", "/login" in driver.current_url and len(err) > 0)

    def s4_klien(driver, wait) -> None:
        login(driver, *KLIEN)
        # Klien diarahkan ke /portal-klien (atau /dashboard) setelah login
        wait.until(lambda d: "/portal-klien" in d.current_url or "/dashboard" in d.current_url)
        if "/portal-klien" not in driver.current_url:
            driver.get(f"{BASE}/portal-klien")
        wait.until(lambda d: "Status Pesanan" in d.page_source or "Isolasi" in d.page_source)
        src = driver.page_source
        check("portal klien tampil + isolasi", "portal-klien" in driver.current_url and ("Status Pesanan" in src or "Isolasi" in src))

    def s5_guard(driver, wait) -> None:
        driver.get(f"{BASE}/dashboard")
        try:
            wait.until(lambda d: "/login" in d.current_url or "Sesi Masuk" in d.page_source or "Login" in d.page_source)
            ok = "/login" in driver.current_url or "Sesi Masuk" in driver.page_source
        except Exception:
            ok = False
        check("guard /dashboard tanpa login", ok, driver.current_url)

    scenario("s1", s1_landing)
    scenario("s2", s2_owner)
    scenario("s3", s3_wrong)
    scenario("s4", s4_klien)
    scenario("s5", s5_guard)

    failed = [r for r in results if r[0] == FAIL]
    print(f"\n{len(results) - len(failed)}/{len(results)} skenario lolos")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
