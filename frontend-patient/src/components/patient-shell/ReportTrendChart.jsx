import { useLang } from "../../i18n.js";

export function ReportTrendChart({ title, unit = "", points = [], zone = "neutral", needsReview = false }) {
  const { t } = useLang();
  if (!Array.isArray(points) || points.length === 0) {
    return (
      <div className="report-trend-card">
        <div className="section-head compact">
          <div>
            <p className="micro strong">{title}</p>
            <p className="micro">{t("no_trend_points")}</p>
          </div>
        </div>
      </div>
    );
  }

  const formatValue = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return "-";
    return Number.isInteger(num) ? String(num) : num.toFixed(num >= 100 ? 0 : 1);
  };

  const values = points.map((item) => Number(item.value)).filter((value) => Number.isFinite(value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const latestPoint = points[points.length - 1];
  const previousPoint = points.length > 1 ? points[points.length - 2] : null;
  const latestValue = Number(latestPoint?.value);
  const previousValue = Number(previousPoint?.value);
  const delta = Number.isFinite(latestValue) && Number.isFinite(previousValue) ? latestValue - previousValue : null;
  const trendLabel =
    delta == null
      ? t("first_reading")
      : delta === 0
        ? t("stable_previous")
        : t("versus_previous", { value: `${delta > 0 ? "+" : ""}${formatValue(delta)}${unit ? ` ${unit}` : ""}` });

  // Context note for large or alarming-looking deltas to prevent patient panic
  const largeDeltaContext = (() => {
    if (delta == null || previousValue === 0) return null;
    const percentChange = Math.abs(delta / previousValue) * 100;
    if (percentChange < 20) return null;
    if (delta > 0 && zone === "high") {
      return t("rise_discuss");
    }
    if (delta < 0 && zone === "low") {
      return t("drop_discuss");
    }
    if (percentChange >= 30) {
      return t("large_change_context");
    }
    return null;
  })();

  if (points.length < 2) {
    return (
      <div className="report-trend-card report-trend-card-single">
        <div className="section-head compact">
          <div>
            <p className="micro strong">{title}</p>
            <p className={`micro report-zone-${zone}`}>{zone === "high" ? t("above_range") : zone === "low" ? t("below_range") : t("within_range")}</p>
          </div>
          {needsReview ? <span className="report-badge report-zone-low">{t("needs_review")}</span> : null}
        </div>
        <div className="report-trend-value">{formatValue(latestValue)}{unit ? <span>{unit}</span> : null}</div>
        <div className="report-trend-meta">
          <span>{latestPoint?.label ? new Date(latestPoint.label).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : t("latest_report")}</span>
          <span>{t("one_more_compare")}</span>
        </div>
      </div>
    );
  }

  const width = 360;
  const height = 220;
  const padLeft = 44;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 42;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const range = max - min || 1;
  const formatAxisLabel = (label, index) =>
    label ? new Date(label).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : `#${index + 1}`;
  const labelGroups = points.reduce((groups, point, index) => {
    const label = formatAxisLabel(point.label, index);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.label === label) {
      lastGroup.indices.push(index);
      return groups;
    }
    groups.push({ label, indices: [index] });
    return groups;
  }, []);
  const maxTickLabels = 4;
  const selectedLabelGroups =
    labelGroups.length <= maxTickLabels
      ? labelGroups
      : Array.from({ length: maxTickLabels }, (_, tickIndex) => {
          const groupIndex = Math.round((tickIndex * (labelGroups.length - 1)) / Math.max(1, maxTickLabels - 1));
          return labelGroups[groupIndex];
        }).filter((group, index, list) => index === 0 || group !== list[index - 1]);
  const yTicks = [0, 0.5, 1].map((ratio) => ({
    value: max - range * ratio,
    y: padTop + plotHeight * ratio,
  }));
  const path = points
    .map((point, index) => {
      const value = Number(point.value);
      const x = padLeft + (plotWidth * index) / Math.max(1, points.length - 1);
      const y = padTop + plotHeight - ((value - min) / range) * plotHeight;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const areaPath = `${path} L ${padLeft + plotWidth} ${padTop + plotHeight} L ${padLeft} ${padTop + plotHeight} Z`;

  return (
    <div className="report-trend-card">
      <div className="section-head compact">
        <div>
          <p className="micro strong">{title}</p>
          <p className={`micro report-zone-${zone}`}>{trendLabel}</p>
        </div>
        {needsReview ? <span className="report-badge report-zone-low">{t("needs_review")}</span> : null}
      </div>
      <div className="report-trend-summary-row">
        <div className="report-trend-value">
          {formatValue(latestValue)}
          {unit ? <span>{unit}</span> : null}
        </div>
        <div className="report-trend-meta">
          <span>{latestPoint?.label ? new Date(latestPoint.label).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : t("latest_report")}</span>
          <span>{zone === "high" ? t("above_range") : zone === "low" ? t("below_range") : t("within_range")}</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="report-trend-svg" role="img" aria-label={title}>
        {yTicks.map((tick, index) => (
          <g key={`${title}-ytick-${index}`}>
            <line x1={padLeft} y1={tick.y} x2={padLeft + plotWidth} y2={tick.y} stroke="#e3ebf3" strokeWidth="1" />
            <text x={padLeft - 8} y={tick.y + 4} textAnchor="end" fontSize="11" fill="#75879a">
              {tick.value.toFixed(range < 10 ? 1 : 0)}
            </text>
          </g>
        ))}
        <line x1={padLeft} y1={padTop + plotHeight} x2={padLeft + plotWidth} y2={padTop + plotHeight} stroke="#9cb0c5" strokeWidth="1.2" />
        <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotHeight} stroke="#9cb0c5" strokeWidth="1.2" />
        <path d={areaPath} fill="rgba(36, 99, 166, 0.10)" />
        <path d={path} fill="none" stroke="#2463a6" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => {
          const value = Number(point.value);
          const x = padLeft + (plotWidth * index) / Math.max(1, points.length - 1);
          const y = padTop + plotHeight - ((value - min) / range) * plotHeight;
          return <circle key={`${title}-${index}`} cx={x} cy={y} r="4" fill="#123d68" />;
        })}
        {selectedLabelGroups.map((group, index) => {
          const midpoint = group.indices.reduce((sum, item) => sum + item, 0) / group.indices.length;
          const x = padLeft + (plotWidth * midpoint) / Math.max(1, points.length - 1);
          return (
            <text key={`${title}-xlabel-${index}`} x={x} y={height - 12} textAnchor="middle" fontSize="11" fill="#75879a">
              {group.label}
            </text>
          );
        })}
        <text x={width / 2} y={height - 2} textAnchor="middle" fontSize="11" fill="#75879a">{t("report_date")}</text>
      </svg>
      {largeDeltaContext ? (
        <p className="report-trend-context-note">ℹ️ {largeDeltaContext}</p>
      ) : null}
      {points.length < 3 ? (
        <p className="report-trend-prompt">{t("upload_more_trend")}</p>
      ) : null}
    </div>
  );
}
