import { useState } from "react";

// Shared by every password field (customer + restaurant auth) to show a
// "Caps Lock is on" warning while typing. Checked on both keydown and keyup
// since browsers only reliably report the CapsLock modifier state on actual
// key events, not on focus/blur.
export function useCapsLockWarning() {
  const [capsLockOn, setCapsLockOn] = useState(false);

  function checkCapsLock(e) {
    if (typeof e.getModifierState === "function") {
      setCapsLockOn(e.getModifierState("CapsLock"));
    }
  }

  return { capsLockOn, checkCapsLock };
}
