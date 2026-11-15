import { icon } from "./dashboard.mjs";

export function installSupervisorShell() {
  const isSupervisor = () =>
    typeof state !== "undefined" && state.profile?.role === "supervisor";
  const originals = new WeakMap();
  const groups = [
    [
      "المتابعة اليومية",
      ["home", "halaqas", "supervision", "sessions", "visits"],
    ],
    ["الحلقات والكادر", ["students", "staff", "org", "approvals"]],
    ["التقارير والإنجاز", ["reports", "ranking", "insights", "exams"]],
    ["التواصل والحساب", ["notifications", "community", "settings"]],
  ];
  function chrome() {
    const active = isSupervisor();
    document.body.classList.toggle("sv-shell", active);
    for (const [selector, name] of [
      [".topbar .menu-btn", "menu"],
      ["#notificationBell", "notifications"],
      ["#h86More", "more"],
    ]) {
      const button = document.querySelector(selector),
        svg = button?.querySelector("svg");
      if (!svg) continue;
      if (active && !svg.hasAttribute("data-sv-icon")) {
        originals.set(button, svg.cloneNode(true));
        svg.outerHTML = icon(name, 22);
      } else if (
        !active &&
        svg.hasAttribute("data-sv-icon") &&
        originals.has(button)
      ) {
        svg.replaceWith(originals.get(button).cloneNode(true));
      }
    }
    if (active)
      document
        .getElementById("h86More")
        ?.setAttribute(
          "aria-expanded",
          String(Boolean(document.getElementById("h86Menu"))),
        );
    return active;
  }
  const previousIcon = window.navSvg;
  window.navSvg = function (route) {
    return isSupervisor()
      ? icon(route, 22)
      : previousIcon.apply(this, arguments);
  };
  const previousIconFor = window.iconFor;
  window.iconFor = function (route) {
    return isSupervisor()
      ? icon(route, 22)
      : previousIconFor.apply(this, arguments);
  };
  const previousMobile = window.buildMobileNav;
  window.buildMobileNav = function () {
    const active = chrome(),
      nav = document.getElementById("mobileNav");
    nav?.classList.toggle("sv-nav", active);
    if (!active) return previousMobile.apply(this, arguments);
    if (!nav) return;
    const items = [
      ["home", "الرئيسية"],
      ["halaqas", "الحلقات"],
      ["supervision", "المتابعة"],
      ["visits", "الزيارات"],
      ["more", "المزيد"],
    ];
    const open = document.getElementById("drawer")?.classList.contains("open");
    const signature = `supervisor|${state.page}|${open}`;
    if (nav.dataset.sig === signature) return;
    nav.dataset.sig = signature;
    nav.innerHTML = items
      .map(([route, label]) => {
        const selected =
          route === "more"
            ? open ||
              !items.some(([key]) => key !== "more" && key === state.page)
            : route === state.page;
        return `<button type="button" class="sv-tab ${selected ? "on" : ""}" ${selected && route !== "more" ? 'aria-current="page"' : ""} ${route === "more" ? `aria-expanded="${Boolean(open)}"` : ""} onclick="${route === "more" ? "toggleDrawer(true)" : `go('${route}')`}">${icon(route, 23)}<span>${label}</span></button>`;
      })
      .join("");
  };
  const previousNav = window.buildNav;
  window.buildNav = function () {
    if (!chrome()) return previousNav.apply(this, arguments);
    const nav = document.getElementById("nav"),
      items = window.navItems();
    if (nav) {
      const e = window.RC50.e;
      nav.innerHTML = groups
        .map(([title, routes]) => {
          const available = routes
            .map((route) => items.find(([id]) => id === route))
            .filter(Boolean);
          return available.length
            ? `<section class="sv-menu-group"><h2>${title}</h2>${available.map(([route, label]) => `<button type="button" class="${state.page === route ? "active" : ""}" ${state.page === route ? 'aria-current="page"' : ""} onclick="go('${route}')">${icon(route)}<span>${e(label)}</span></button>`).join("")}</section>`
            : "";
        })
        .join("");
    }
    window.buildMobileNav();
  };
  const previousRender = window.render;
  window.render = async function () {
    const result = await previousRender.apply(this, arguments);
    chrome();
    return result;
  };
  chrome();
}
