"use client";

import { Printer } from "@phosphor-icons/react";
import { buttonClass } from "./ui";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("secondary", "sm")}>
      <Printer size={16} aria-hidden /> Print or save PDF
    </button>
  );
}
