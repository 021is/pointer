// The short message at the top of the view: what happened, or why it failed (errors stay longer),
// with one optional action (Undo after a clear).

export type ToastAction = { label: string; run: () => void };

export type Toast = { el: HTMLElement; say: (message: string, kind?: "ok" | "error", action?: ToastAction) => void };

export function createToast(): Toast {
  const el = Object.assign(document.createElement("div"), { className: "toast" });
  el.setAttribute("role", "status");
  let timer = 0;
  const hide = () => el.removeAttribute("data-show");
  return {
    el,
    say(message, kind = "ok", action) {
      el.replaceChildren(Object.assign(document.createElement("span"), { textContent: message }));
      if (action) {
        const b = Object.assign(document.createElement("button"), { type: "button", textContent: action.label });
        b.addEventListener("click", () => {
          hide();
          action.run();
        });
        el.append(b);
      }
      el.dataset.kind = kind;
      el.setAttribute("data-show", "");
      clearTimeout(timer);
      timer = window.setTimeout(hide, kind === "error" || action ? 6000 : 2600);
    },
  };
}
