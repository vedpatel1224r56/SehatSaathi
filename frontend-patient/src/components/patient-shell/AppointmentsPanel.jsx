export function AppointmentsPanel({
  t,
  teleStatusLabel,
  submitCareRequest,
  careRequestMode,
  setCareRequestMode,
  appointmentForm,
  setAppointmentForm,
  departments,
  departmentDoctors,
  availableSlots,
  slotStatus,
  teleForm,
  updateTeleField,
  teleStatus,
  appointmentsStatus,
  appointmentsViewTab,
  setAppointmentsViewTab,
  futureAppointments,
  pastAppointments,
  requestedAppointments,
  requestedCare,
  openAppointmentDetail,
  openTeleconsultRoom,
  paymentGatewayConfig,
  payForAppointment,
  payForTeleconsult,
  paymentLoadingKey,
  consultPaymentStatus,
}) {
  const renderEmptyState = (title, body) => (
    <div className="patient-empty-state">
      <div className="patient-empty-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4.5" y="5.5" width="15" height="14" rx="3" />
          <path d="M8 4.5v3M16 4.5v3M4.5 10h15" />
        </svg>
      </div>
      <p className="history-headline">{title}</p>
      <p className="micro">{body}</p>
    </div>
  )

  const allowLocalPaymentBypass = Boolean(import.meta.env.DEV)
  const formatAppointmentStatus = (status) => {
    const normalized = String(status || '').toLowerCase()
    if (normalized === 'approved') return 'Scheduled'
    if (normalized === 'checked_in') return 'Checked in'
    if (normalized === 'no_show') return 'No show'
    if (!normalized) return '-'
    return normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  }
  const selectedDoctor = departmentDoctors.find((doctor) => String(doctor.id) === String(appointmentForm.doctorId))
  const selectedFee =
    careRequestMode === "chat"
      ? Number(selectedDoctor?.chat_fee || 0)
      : careRequestMode === "video"
        ? Number(selectedDoctor?.video_fee || 0)
        : careRequestMode === "audio"
          ? Number(selectedDoctor?.audio_fee || 0)
          : Number(selectedDoctor?.in_person_fee || 0)
  const formatBillStatus = (status) => {
    const normalized = String(status || "unpaid").toLowerCase()
    if (normalized === "paid") return "Paid"
    if (normalized === "partial") return "Partially paid"
    if (normalized === "waived") return "Waived"
    return "Unpaid"
  }
  const activeHistoryCount =
    appointmentsViewTab === "future"
      ? futureAppointments.length
      : appointmentsViewTab === "past"
        ? pastAppointments.length
        : requestedAppointments.length + requestedCare.length

  return (
    <section className="panel appointments-panel">
      <div className="appointments-shell-hero">
        <div className="appointments-shell-copy">
          <p className="eyebrow">Appointments</p>
          <h2>Visits</h2>
          <p className="panel-sub">Book a visit and keep requests easy to review.</p>
        </div>
      </div>
      <div className="appointments-layout">
        <form className="form appointments-booking-card" onSubmit={submitCareRequest}>
          <div className="appointments-card-head">
            <div>
              <p className="eyebrow">Book a visit</p>
              <h3>Appointment details</h3>
            </div>
            <div className="appointments-mode-strip">
              <span className="micro strong">Mode</span>
              <span className="appointments-mode-pill">{careRequestMode === "in_person" ? "In-person visit" : `${careRequestMode} consult`}</span>
            </div>
          </div>
          <label className="block">
            {t("careRequestType")}
            <select value={careRequestMode} onChange={(event) => setCareRequestMode(event.target.value)}>
              <option value="in_person">{t("careRequestInPerson")}</option>
              <option value="chat">{t("teleModeChat")}</option>
              <option value="video">{t("teleModeVideo")}</option>
              <option value="audio">{t("teleModeAudio")}</option>
            </select>
          </label>
          {["chat", "audio", "video"].includes(careRequestMode) ? (
            <div className="appointments-coming-soon-note">
              <p className="micro">
                {careRequestMode === "audio"
                  ? "Audio consult opens in a browser meeting room once the consult is scheduled."
                  : careRequestMode === "video"
                    ? "Video consult opens in a browser meeting room once the consult is scheduled."
                    : "Chat consult is live now. Audio and video consults open in browser meeting rooms once scheduled."}
              </p>
            </div>
          ) : null}
          {selectedDoctor ? (
            <div className="history-card subtle appointments-fee-card">
              <p className="micro strong">Consultation fee</p>
              <p className="history-headline">Rs {selectedFee || 0}</p>
              <p className="micro">
                {selectedFee > 0 ? "This will be available for online payment right after booking." : "No online consultation fee is configured for this doctor yet."}
              </p>
            </div>
          ) : null}
          {careRequestMode === "in_person" ? (
            <>
              <label className="block">
                {t("apptDepartment")}
                <select
                  value={appointmentForm.departmentId}
                  onChange={(event) =>
                    setAppointmentForm((prev) => ({ ...prev, departmentId: event.target.value, doctorId: "", slotTime: "" }))
                  }
                >
                  <option value="">Select department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                Doctor
                <select
                  value={appointmentForm.doctorId}
                  onChange={(event) =>
                    setAppointmentForm((prev) => ({ ...prev, doctorId: event.target.value, slotTime: "" }))
                  }
                >
                  <option value="">Select doctor</option>
                  {departmentDoctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                {t("apptReason")}
                <textarea
                  rows={3}
                  value={appointmentForm.reason}
                  onChange={(event) => setAppointmentForm((prev) => ({ ...prev, reason: event.target.value }))}
                />
              </label>
              <div className="form-row">
                <label>
                  Appointment date
                  <input
                    type="date"
                    value={appointmentForm.appointmentDate}
                    onChange={(event) =>
                      setAppointmentForm((prev) => ({ ...prev, appointmentDate: event.target.value, slotTime: "" }))
                    }
                  />
                </label>
                <label>
                  Slot
                  <select
                    value={appointmentForm.slotTime}
                    onChange={(event) => setAppointmentForm((prev) => ({ ...prev, slotTime: event.target.value }))}
                  >
                    <option value="">Select slot</option>
                    {availableSlots.map((slot) => (
                      <option key={slot.dateTime} value={slot.time}>
                        {slot.time}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {slotStatus && <p className="micro">{slotStatus}</p>}
              <button className="primary full" type="submit">
                {t("apptBook")}
              </button>
            </>
          ) : (
            <>
              <label className="block">
                {t("apptDepartment")}
                <select
                  value={appointmentForm.departmentId}
                  onChange={(event) =>
                    setAppointmentForm((prev) => ({ ...prev, departmentId: event.target.value, doctorId: "", slotTime: "" }))
                  }
                >
                  <option value="">Select department</option>
                  {departments.map((department) => (
                    <option key={`remote-department-${department.id}`} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                Doctor
                <select
                  value={appointmentForm.doctorId}
                  onChange={(event) =>
                    setAppointmentForm((prev) => ({ ...prev, doctorId: event.target.value, slotTime: "" }))
                  }
                >
                  <option value="">Select doctor</option>
                  {departmentDoctors.map((doctor) => (
                    <option key={`remote-doctor-${doctor.id}`} value={doctor.id}>
                      {doctor.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-row">
                <label>
                  Appointment date
                  <input
                    type="date"
                    value={appointmentForm.appointmentDate}
                    onChange={(event) =>
                      setAppointmentForm((prev) => ({ ...prev, appointmentDate: event.target.value, slotTime: "" }))
                    }
                  />
                </label>
                <label>
                  Slot
                  <select
                    value={appointmentForm.slotTime}
                    onChange={(event) => setAppointmentForm((prev) => ({ ...prev, slotTime: event.target.value }))}
                  >
                    <option value="">Select slot</option>
                    {availableSlots.map((slot) => (
                      <option key={`remote-slot-${slot.dateTime}`} value={slot.time}>
                        {slot.time}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {slotStatus && <p className="micro">{slotStatus}</p>}
              <label className="block">
                {t("telePhone")}
                <input type="text" value={teleForm.phone} onChange={(event) => updateTeleField("phone", event.target.value)} />
              </label>
              <label className="block">
                {t("teleConcern")}
                <textarea rows={3} value={teleForm.concern} onChange={(event) => updateTeleField("concern", event.target.value)} />
              </label>
              <button className="primary full" type="submit">
                {t("teleBook")}
              </button>
            </>
          )}
        </form>

        <div className="appointments-feed-card">
          <div className="appointments-card-head">
            <div>
              <p className="eyebrow">Your visits</p>
              <h3>Activity</h3>
            </div>
            <span className="appointments-history-count">{activeHistoryCount}</span>
          </div>
          <div className="member-list appointments-tab-strip">
            <button
              type="button"
              className={appointmentsViewTab === "future" ? "chip active" : "chip"}
              onClick={() => setAppointmentsViewTab("future")}
            >
              Future
            </button>
            <button
              type="button"
              className={appointmentsViewTab === "past" ? "chip active" : "chip"}
              onClick={() => setAppointmentsViewTab("past")}
            >
              Past
            </button>
            <button
              type="button"
              className={appointmentsViewTab === "requested" ? "chip active" : "chip"}
              onClick={() => setAppointmentsViewTab("requested")}
            >
              Requested
            </button>
          </div>
          <div className="history-list appointments-history-list" style={{ marginTop: 16 }}>
          {(teleStatus || appointmentsStatus || consultPaymentStatus) && <p className="micro patient-status-note">{teleStatus || appointmentsStatus || consultPaymentStatus}</p>}
        {appointmentsViewTab === "future" &&
          futureAppointments.slice(0, 8).map((appointment) => (
            <div key={`appt-mobile-future-${appointment.id}`} className="history-card appointments-history-card">
              <p className="history-headline">
                {appointment.department_name || appointment.department}
                {appointment.doctor_name ? ` • Dr. ${appointment.doctor_name}` : ""}
              </p>
              <p className="micro">{appointment.reason}</p>
              <p className="micro">
                {formatAppointmentStatus(appointment.status)} • {new Date(appointment.scheduled_at).toLocaleString()}
              </p>
              <p className="micro">Fee: Rs {Number(appointment.bill_amount || 0)} • {formatBillStatus(appointment.bill_status)}</p>
              <div className="action-row">
                <button type="button" className="secondary" onClick={() => openAppointmentDetail(appointment)}>
                  View details
                </button>
                {!allowLocalPaymentBypass && paymentGatewayConfig?.enabled && Number(appointment.bill_amount || 0) > 0 && !["paid", "waived"].includes(String(appointment.bill_status || "").toLowerCase()) ? (
                  <button
                    type="button"
                    className="primary"
                    onClick={() => payForAppointment(appointment)}
                    disabled={paymentLoadingKey === `appointment-${appointment.id}`}
                  >
                    {paymentLoadingKey === `appointment-${appointment.id}` ? "Opening payment..." : `Pay Rs ${Number(appointment.bill_amount || 0)}`}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        {appointmentsViewTab === "past" &&
          pastAppointments.slice(0, 8).map((appointment) => (
            <div key={`appt-mobile-past-${appointment.id}`} className="history-card appointments-history-card">
              <p className="history-headline">
                {appointment.department_name || appointment.department}
                {appointment.doctor_name ? ` • Dr. ${appointment.doctor_name}` : ""}
              </p>
              <p className="micro">{appointment.reason}</p>
              <p className="micro">
                {formatAppointmentStatus(appointment.status)} • {new Date(appointment.scheduled_at).toLocaleString()}
              </p>
              <p className="micro">Fee: Rs {Number(appointment.bill_amount || 0)} • {formatBillStatus(appointment.bill_status)}</p>
              <div className="action-row">
                <button type="button" className="secondary" onClick={() => openAppointmentDetail(appointment)}>
                  View details
                </button>
              </div>
            </div>
          ))}
        {appointmentsViewTab === "requested" &&
          requestedCare.slice(0, 8).map((consult) => (
            (() => {
              const consultMode = String(consult.mode || "").toLowerCase()
              const isLiveConsult = ["chat", "audio", "video"].includes(consultMode)
              const consultStatus = String(consult.status || "").toLowerCase()
              const isConsultScheduled = ["scheduled", "in_progress", "completed"].includes(consultStatus)
              const isConsultPaid =
                allowLocalPaymentBypass ||
                Number(consult.billAmount || 0) <= 0 ||
                ["paid", "waived"].includes(String(consult.billStatus || "").toLowerCase())
              const canOpenConsult = isLiveConsult && isConsultScheduled && isConsultPaid
              const openLabel = !isLiveConsult
                ? "Coming soon"
                : !isConsultScheduled
                  ? "Awaiting schedule"
                  : !isConsultPaid
                    ? "Complete payment"
                    : "Open consult"
              return (
                <div key={`consult-mobile-${consult.id}`} className="history-card appointments-history-card">
                  <p className="history-headline">
                    {teleStatusLabel(consult.status) || consult.status} • {consult.mode}
                  </p>
                  <p className="micro">
                    {consult.departmentName || "-"}
                    {consult.doctorName ? ` • Dr. ${consult.doctorName}` : ""}
                  </p>
                  <p className="micro">{consult.concern}</p>
                  {consult.preferredSlot && <p className="micro">{new Date(consult.preferredSlot).toLocaleString()}</p>}
                  <p className="micro">Fee: Rs {Number(consult.billAmount || 0)} • {formatBillStatus(consult.billStatus)}</p>
                  <div className="action-row">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => openTeleconsultRoom(consult)}
                      disabled={!canOpenConsult}
                    >
                      {openLabel}
                    </button>
                    {!allowLocalPaymentBypass && paymentGatewayConfig?.enabled && Number(consult.billAmount || 0) > 0 && !["paid", "waived"].includes(String(consult.billStatus || "").toLowerCase()) ? (
                      <button
                        type="button"
                        className="primary"
                        onClick={() => payForTeleconsult(consult)}
                        disabled={paymentLoadingKey === `teleconsult-${consult.id}`}
                      >
                        {paymentLoadingKey === `teleconsult-${consult.id}` ? "Opening payment..." : `Pay Rs ${Number(consult.billAmount || 0)}`}
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })()
          ))}
        {appointmentsViewTab === "requested" &&
          requestedAppointments.slice(0, 8).map((appointment) => (
            <div key={`appt-mobile-requested-${appointment.id}`} className="history-card appointments-history-card">
              <p className="history-headline">
                Appointment request • {appointment.department_name || appointment.department}
                {appointment.doctor_name ? ` • Dr. ${appointment.doctor_name}` : ""}
              </p>
              <p className="micro">{appointment.reason}</p>
              <p className="micro">
                {formatAppointmentStatus(appointment.status)} • {new Date(appointment.scheduled_at).toLocaleString()}
              </p>
              <p className="micro">Fee: Rs {Number(appointment.bill_amount || 0)} • {formatBillStatus(appointment.bill_status)}</p>
              <div className="action-row">
                <button type="button" className="secondary" onClick={() => openAppointmentDetail(appointment)}>
                  View details
                </button>
                {!allowLocalPaymentBypass && paymentGatewayConfig?.enabled && Number(appointment.bill_amount || 0) > 0 && !["paid", "waived"].includes(String(appointment.bill_status || "").toLowerCase()) ? (
                  <button
                    type="button"
                    className="primary"
                    onClick={() => payForAppointment(appointment)}
                    disabled={paymentLoadingKey === `appointment-${appointment.id}`}
                  >
                    {paymentLoadingKey === `appointment-${appointment.id}` ? "Opening payment..." : `Pay Rs ${Number(appointment.bill_amount || 0)}`}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        {appointmentsViewTab === "future" && futureAppointments.length === 0 && renderEmptyState("No upcoming visits", "Once a visit is booked, it will appear here with timing and payment status.")}
        {appointmentsViewTab === "past" && pastAppointments.length === 0 && renderEmptyState("No past visits yet", "Completed visits and consult history will build your timeline here.")}
        {appointmentsViewTab === "requested" && requestedCare.length === 0 && requestedAppointments.length === 0 && (
          renderEmptyState("No pending requests", "New appointment and consult requests will stay here until they are scheduled.")
        )}
          </div>
        </div>
      </div>
    </section>
  );
}
