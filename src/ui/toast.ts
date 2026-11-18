// The short message above the bar: what Copy did, or why it failed (errors stay longer).

export type Toast = { el: HTMLElement; say: (message: string, kind?: "ok" | "error") => void };

export function createToast(): Toast {
  const el = Object.assign(document.createElement("div"), { className: "toast" });
  el.setAttribute("role", "status");
  let timer = 0;
  return {
    el,
    say(message, kind = "ok") {
      el.textContent = message;
      el.dataset.kind = kind;
      el.setAttribute("data-show", "");
      clearTimeout(timer);
      timer = window.setTimeout(() => el.removeAttribute("data-show"), kind === "error" ? 6000 : 2600);
    },
  };
}
