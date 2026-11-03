"use client";
import { useEffect } from "react";

export function MarketingInteractions({ pageKey }: { pageKey: string }) {
  useEffect(() => {
    const root = document.querySelector(".approved-marketing");
    if (!root) return;
    const cleanup: (() => void)[] = [];
    root.querySelectorAll<HTMLButtonElement>('[aria-controls^="answer-"]').forEach(button => {
      const toggle = () => {
        const open = button.getAttribute("aria-expanded") !== "true";
        button.setAttribute("aria-expanded", String(open));
        const answer = document.getElementById(button.getAttribute("aria-controls")!);
        if (answer) answer.hidden = !open;
        if (button.lastElementChild) button.lastElementChild.textContent = open ? "−" : "+";
      };
      button.addEventListener("click", toggle);
      cleanup.push(() => button.removeEventListener("click", toggle));
    });
    const menu = root.querySelector<HTMLButtonElement>('button[class*="__menuButton"]');
    const desktopNav = root.querySelector("header nav");
    if (menu && desktopNav) {
      const nav = desktopNav.cloneNode(true) as HTMLElement;
      nav.className = "prototype-mobile-nav";
      nav.id = "mobile-navigation";
      nav.hidden = true;
      nav.setAttribute("aria-label", "Mobile navigation");
      root.querySelector("header")!.after(nav);
      menu.setAttribute("aria-controls", nav.id);
      const close = () => { nav.hidden = true; menu.setAttribute("aria-expanded", "false"); menu.setAttribute("aria-label", "Open menu"); };
      const toggle = () => { const open = nav.hidden; nav.hidden = !open; menu.setAttribute("aria-expanded", String(open)); menu.setAttribute("aria-label", open ? "Close menu" : "Open menu"); };
      const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !nav.hidden) { close(); menu.focus(); } };
      menu.addEventListener("click", toggle);
      nav.addEventListener("click", close);
      document.addEventListener("keydown", escape);
      cleanup.push(() => { menu.removeEventListener("click", toggle); document.removeEventListener("keydown", escape); nav.remove(); });
    }
    return () => cleanup.forEach(dispose => dispose());
  }, [pageKey]);
  return null;
}
