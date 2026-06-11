export const computeProfileCompletion = (profile = {}) => {
  const checks = [
    Boolean(String(profile.fullName || "").trim()),
    Boolean(String(profile.email || "").trim()),
    Boolean(String(profile.age || "").trim()),
    Boolean(profile.sex),
    Boolean(String(profile.phone || "").trim()),
    Boolean(String(profile.abhaNumber || profile.abhaAddress || "").trim()),
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
};

export const sortLabs = (labs = [], mode = "all", sortBy = "cheapest") => {
  const getPrice = (lab) => {
    const price = Number(lab.startingPrice || 0);
    return price > 0 ? price : Number.POSITIVE_INFINITY;
  };
  return [...labs].sort((a, b) => {
    if (sortBy === "fastest") return (a.etaMinutes || 0) - (b.etaMinutes || 0);
    if (sortBy === "nearest") return (a.distanceKm || 0) - (b.distanceKm || 0);
    return getPrice(a) - getPrice(b);
  });
};

export const sortPharmacies = (pharmacies = [], sortBy = "fastest") => {
  return [...pharmacies].sort((a, b) => {
    if (sortBy === "cheapest") return (a.deliveryFee || 0) - (b.deliveryFee || 0);
    if (sortBy === "nearest") return (a.distanceKm || 0) - (b.distanceKm || 0);
    return (a.etaMinutes || 0) - (b.etaMinutes || 0);
  });
};

export const formatMarketplaceStatus = (status) =>
  String(status || "requested")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const normalizeHospitalContent = (payload = {}, apiBase = "") => {
  const profile = payload?.profile || {};
  const content = payload?.content || {};
  const contentVersion = String(payload?.updatedAt || "").trim();
  const resolveContentImageUrl = (value) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    const absolute = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : !apiBase
        ? trimmed
        : `${apiBase}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
    if (!contentVersion) return absolute;
    return `${absolute}${absolute.includes("?") ? "&" : "?"}v=${encodeURIComponent(contentVersion)}`;
  };
  const today = new Date().toISOString().slice(0, 10);
  const patientUpdates = Array.isArray(content?.patientUpdates)
    ? content.patientUpdates
        .map((item, index) => ({
          id: item?.id || `hospital-update-${index}`,
          title: item?.title || "",
          summary: item?.summary || "",
          body: item?.body || "",
          imageUrl: resolveContentImageUrl(item?.imageUrl),
          seasonTag: item?.seasonTag || "",
          audience: item?.audience || "all",
          startDate: item?.startDate || "",
          endDate: item?.endDate || "",
          active: item?.active !== false,
        }))
        .filter((item) => {
          if (!item.active) return false;
          if (item.startDate && item.startDate > today) return false;
          if (item.endDate && item.endDate < today) return false;
          return Boolean(item.title || item.summary || item.body || item.imageUrl);
        })
    : [];
  return {
    profile: {
      hospitalName:
        profile.hospital_name === "SehatSaathi X Savita Hospital"
          ? "SehatSaathi Hospital"
          : profile.hospital_name || "SehatSaathi Hospital",
      contactPhone: profile.contact_phone || "",
      contactEmail: profile.contact_email || "",
      addressLine: profile.address_line || "",
      taluka: profile.taluka || "",
      district: profile.district || "",
      city: profile.city || "",
      state: profile.state || "",
      country: profile.country || "India",
      pinCode: profile.pin_code || "",
    },
    sections: {
      cashless: {
        title: content?.cashless?.title || "Cashless Facility Available",
        cashlessFacilityList: Array.isArray(content?.cashless?.cashlessFacilityList)
          ? content.cashless.cashlessFacilityList
          : [],
        tpaList: Array.isArray(content?.cashless?.tpaList) ? content.cashless.tpaList : [],
        corporateList: Array.isArray(content?.cashless?.corporateList) ? content.cashless.corporateList : [],
        tpaQueryPhone: content?.cashless?.tpaQueryPhone || profile.contact_phone || "",
      },
      services: {
        title: content?.scopeOfServices?.title || "Scope of Services",
        clinicalServices: Array.isArray(content?.scopeOfServices?.clinicalServices)
          ? content.scopeOfServices.clinicalServices
          : [],
        stateOfTheArt: Array.isArray(content?.scopeOfServices?.stateOfTheArt)
          ? content.scopeOfServices.stateOfTheArt
          : [],
        services24x7: Array.isArray(content?.scopeOfServices?.services24x7)
          ? content.scopeOfServices.services24x7
          : [],
        appointmentPhones: Array.isArray(content?.scopeOfServices?.appointmentPhones)
          ? content.scopeOfServices.appointmentPhones
          : [],
      },
      healthCheckup: {
        title: content?.healthCheckup?.title || "Health Check-up",
        plans: Array.isArray(content?.healthCheckup?.plans) ? content.healthCheckup.plans : [],
      },
      ayushman: {
        title: content?.ayushman?.title || "Ayushman Support",
        bullets: Array.isArray(content?.ayushman?.bullets) ? content.ayushman.bullets : [],
        helpPhones: Array.isArray(content?.ayushman?.helpPhones) ? content.ayushman.helpPhones : [],
      },
      specialities: {
        title: content?.superSpecialities?.title || "Our Super-Specialities",
        departments: Array.isArray(content?.superSpecialities?.departments)
          ? content.superSpecialities.departments
          : [],
        contactPhone: content?.superSpecialities?.contactPhone || profile.contact_phone || "",
      },
    },
    patientUpdates,
  };
};

export const normalizeLabListings = (labs = []) =>
  (Array.isArray(labs) ? labs : []).map((lab) => ({
    id: lab.lab_id,
    partnerName: lab.partner_name || "Lab partner",
    areaLabel: lab.area_label || "",
    distanceKm: Number(lab.distance_km || 0),
    etaMinutes: Number(lab.eta_minutes || 0),
    etaSlaMinutes: Number(lab.eta_sla_minutes || lab.eta_minutes || 0),
    homeCollectionAvailable: Boolean(lab.home_collection_available),
    startingPrice: lab.starting_price == null ? null : Number(lab.starting_price),
    homeStartingPrice: lab.home_starting_price == null ? null : Number(lab.home_starting_price),
    priceLastUpdatedAt: lab.price_last_updated_at || "",
    tests: (lab.tests || []).map((item) => ({
      id: item.id,
      serviceName: item.service_name || item.test_name || "",
      price: Number(item.price || 0),
      homeVisitPrice: item.home_visit_price == null ? null : Number(item.home_visit_price),
      homeCollectionAvailable: Boolean(item.home_collection_available),
    })),
    packages: (lab.packages || []).map((item) => ({
      id: item.id,
      serviceName: item.service_name || item.package_name || "",
      price: Number(item.price || 0),
      homeVisitPrice: item.home_visit_price == null ? null : Number(item.home_visit_price),
      homeCollectionAvailable: Boolean(item.home_collection_available),
    })),
  }));

export const normalizePharmacyListings = (items = []) =>
  (Array.isArray(items) ? items : []).map((item) => ({
    id: item.id,
    partnerName: item.partner_name || "Pharmacy partner",
    areaLabel: item.area_label || "",
    medicinePriceNote: item.medicine_price_note || "",
    deliveryFee: Number(item.delivery_fee || 0),
    etaMinutes: Number(item.eta_minutes || 0),
    etaSlaMinutes: Number(item.eta_sla_minutes || item.eta_minutes || 0),
    distanceKm: Number(item.distance_km || 0),
    homeDeliveryAvailable: Boolean(item.home_delivery_available),
    pickupAvailable: Boolean(item.pickup_available),
    priceLastUpdatedAt: item.price_last_updated_at || "",
  }));
