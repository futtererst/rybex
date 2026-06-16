export function focusTarget(targetId = "details-records") {
  const target = document.getElementById(targetId);
  const detailsContainer = targetId === "details-records"
    ? target
    : target?.closest<HTMLElement>("#details-records");
  const details = detailsContainer?.querySelector<HTMLDetailsElement>("details");

  if (details && !details.open) {
    details.open = true;
  }

  const focusElement = target ?? detailsContainer;

  if (!focusElement) {
    return;
  }

  focusElement.classList.remove("cta-focus-highlight");
  window.requestAnimationFrame(() => {
    focusElement.classList.add("cta-focus-highlight");
    focusElement.scrollIntoView({ behavior: "smooth", block: "start" });
    focusElement.focus({ preventScroll: true });
  });
}

export function focusHashTarget(href: string) {
  if (!href.startsWith("#")) {
    return;
  }

  focusTarget(href.slice(1));
}
