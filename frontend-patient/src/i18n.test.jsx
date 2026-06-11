import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useLang } from "./i18n.js";

function LanguageProbe({ id }) {
  const { lang, switchLang, t } = useLang();
  return (
    <div>
      <span data-testid={`${id}-lang`}>{lang}</span>
      <span data-testid={`${id}-label`}>{t("nav_today")}</span>
      {id === "first" ? (
        <button type="button" onClick={() => switchLang("gu")}>ગુજરાતી</button>
      ) : null}
    </div>
  );
}

describe("patient language store", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "en";
  });

  it("updates every subscriber and persists Gujarati", () => {
    render(
      <>
        <LanguageProbe id="first" />
        <LanguageProbe id="second" />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "ગુજરાતી" }));

    expect(screen.getByTestId("first-lang")).toHaveTextContent("gu");
    expect(screen.getByTestId("second-lang")).toHaveTextContent("gu");
    expect(screen.getByTestId("first-label")).toHaveTextContent("આજે");
    expect(screen.getByTestId("second-label")).toHaveTextContent("આજે");
    expect(localStorage.getItem("ssp_lang")).toBe("gu");
    expect(document.documentElement.lang).toBe("gu");
  });
});
