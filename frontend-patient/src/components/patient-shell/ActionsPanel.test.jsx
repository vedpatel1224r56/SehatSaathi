import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ActionsPanel } from "./ActionsPanel";

const reportInsights = {
  actionMap: {
    headline: "Your fasting blood sugar is 138 mg/dL — above the 99 mg/dL normal range.",
    thisWeek: ["Save one fasting sugar reading.", "Walk after your largest meal.", "Keep one doctor question ready."],
    retest: "4 weeks",
    bringToDoctor: "Ask what target range is right for you.",
  },
  doctorQuestions: ["What should I track before my next visit?"],
};

describe("ActionsPanel", () => {
  it("replaces temporary activity with persisted activity returned by the backend", async () => {
    const persistedActivity = [
      {
        id: 42,
        trackerKey: "bloodSugar",
        label: "Blood sugar",
        value: "110",
        unit: "mg/dL",
        loggedAt: "2026-06-08T06:30:00.000Z",
      },
    ];
    const apiFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        plan: { title: "Health note", focusTitle: "Blood sugar", focusSummary: "110" },
        activity: persistedActivity,
      }),
    });
    const onActivitySaved = vi.fn();

    render(
      <ActionsPanel
        activeMemberId={null}
        apiBase="http://localhost:8080"
        apiFetch={apiFetch}
        reportInsights={reportInsights}
        healthPlanActivity={[]}
        onActivitySaved={onActivitySaved}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /blood sugar/i }));
    fireEvent.click(screen.getByRole("button", { name: "110" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/health-plan/activity",
        expect.objectContaining({ method: "POST" }),
      );
      expect(onActivitySaved).toHaveBeenCalledWith(
        [expect.objectContaining({ trackerKey: "bloodSugar", value: "110", loggedAt: "2026-06-08T06:30:00.000Z" })],
        expect.objectContaining({ focusTitle: "Blood sugar" }),
      );
    });
  });
});
