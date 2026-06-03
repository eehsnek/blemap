export const LOGO_SRC = "/frontend/assets/logo.jpeg";

export function mountAuthBrand(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div class="flex flex-col items-center mb-6">
      <img src="${LOGO_SRC}" alt="BleMap logo" width="80" height="80"
        class="w-20 h-20 object-contain rounded-xl" />
      <span class="mt-3 text-sm uppercase tracking-[0.2em] text-[#43e2d2]">BleMap</span>
    </div>
  `;
}

export function navBrandHtml() {
  return `
    <button type="button" id="nav-home-logo" class="nav-brand-btn">
      <img src="${LOGO_SRC}" alt="BleMap" width="40" height="40" />
      <span>BleMap</span>
    </button>
  `;
}
