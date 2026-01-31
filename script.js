const LOCAL_CALENDAR_URL = "7FECE5F2-924D-4559-AF11-8BF7F2E80EBD (2).ics";
const REMOTE_CALENDAR_URL =
  "https://api.veracross.com/cate/subscribe/76B2E2E6-2C26-4656-A311-27910AAAAB2D.ics?uid=18A335ED-EFDF-4B52-95CD-EA80F989F34B";
const CORS_PROXY_URL = "https://api.allorigins.win/raw?url=";

const statusValue = document.getElementById("status-value");
const statusDetail = document.getElementById("status-detail");
const statusNext = document.getElementById("status-next");
const statusUpdated = document.getElementById("status-updated");
const eventList = document.getElementById("event-list");
const calendarUrl = document.getElementById("calendar-url");

calendarUrl.textContent = LOCAL_CALENDAR_URL;

const INTERDORM_REGEX = /interdorm/i;

const unfoldLines = (text) =>
  text
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]/g, "");

const parseDateValue = (value, tzid) => {
  if (!value) {
    return null;
  }

  if (/^\d{8}$/.test(value)) {
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6)) - 1;
    const day = Number(value.slice(6, 8));
    return new Date(year, month, day);
  }

  const trimmed = value.trim();
  const isUtc = trimmed.endsWith("Z");
  const datePart = trimmed.replace("Z", "");
  const year = Number(datePart.slice(0, 4));
  const month = Number(datePart.slice(4, 6)) - 1;
  const day = Number(datePart.slice(6, 8));
  const hour = Number(datePart.slice(9, 11));
  const minute = Number(datePart.slice(11, 13));
  const second = Number(datePart.slice(13, 15) || 0);

  if (isUtc) {
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }

  if (tzid && tzid !== "local") {
    const localeTime = new Date(year, month, day, hour, minute, second);
    return localeTime;
  }

  return new Date(year, month, day, hour, minute, second);
};

const parseIcs = (icsText) => {
  const events = [];
  const lines = unfoldLines(icsText).split("\n");
  let currentEvent = null;

  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) {
      currentEvent = {};
      continue;
    }

    if (line.startsWith("END:VEVENT")) {
      if (currentEvent) {
        events.push(currentEvent);
      }
      currentEvent = null;
      continue;
    }

    if (!currentEvent) {
      continue;
    }

    const [propertySection, value] = line.split(":", 2);
    if (!value) {
      continue;
    }

    const [propertyName, ...params] = propertySection.split(";");
    const upperName = propertyName.toUpperCase();
    const paramMap = params.reduce((acc, param) => {
      const [key, paramValue] = param.split("=");
      if (key && paramValue) {
        acc[key.toLowerCase()] = paramValue;
      }
      return acc;
    }, {});

    currentEvent[upperName] = {
      value: value.trim(),
      params: paramMap,
    };
  }

  return events;
};

const formatDateTime = (date) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

const formatDuration = (ms) => {
  if (ms <= 0) {
    return "0 minutes";
  }

  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];

  if (days) {
    parts.push(`${days} day${days === 1 ? "" : "s"}`);
  }
  if (hours) {
    parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  }
  if (!days && !hours) {
    parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  } else if (minutes) {
    parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  }

  return parts.join(", ");
};

const normalizeEvents = (rawEvents) =>
  rawEvents
    .map((event) => {
      const summary = event.SUMMARY?.value || "";
      const startRaw = event.DTSTART;
      const endRaw = event.DTEND;

      if (!startRaw || !endRaw) {
        return null;
      }

      const start = parseDateValue(startRaw.value, startRaw.params?.tzid);
      const end = parseDateValue(endRaw.value, endRaw.params?.tzid);

      return {
        summary,
        start,
        end,
      };
    })
    .filter((event) => event && event.start && event.end)
    .sort((a, b) => a.start - b.start);

const renderEvents = (events) => {
  eventList.innerHTML = "";
  if (!events.length) {
    const empty = document.createElement("li");
    empty.className = "event-placeholder";
    empty.textContent = "No interdorm events found in the calendar.";
    eventList.appendChild(empty);
    return;
  }

  events.slice(0, 6).forEach((event) => {
    const item = document.createElement("li");
    item.className = "event-item";

    const title = document.createElement("div");
    title.className = "event-title";
    title.textContent = event.summary;

    const time = document.createElement("div");
    time.className = "event-time";
    time.textContent = `${formatDateTime(event.start)} – ${formatDateTime(
      event.end
    )}`;

    item.appendChild(title);
    item.appendChild(time);
    eventList.appendChild(item);
  });
};

const updateStatus = (events) => {
  const now = new Date();
  const current = events.find((event) => now >= event.start && now <= event.end);
  const upcoming = events.find((event) => event.start > now);

  if (current) {
    const remaining = current.end - now;
    statusValue.textContent = "Interdorm is ON";
    statusValue.classList.add("on");
    statusValue.classList.remove("off");
    statusDetail.textContent = `Ends in ${formatDuration(remaining)}.`;
    statusNext.textContent = `Ends: ${formatDateTime(current.end)}`;
  } else {
    statusValue.textContent = "Interdorm is OFF";
    statusValue.classList.add("off");
    statusValue.classList.remove("on");

    if (upcoming) {
      const until = upcoming.start - now;
      statusDetail.textContent = `Next session starts in ${formatDuration(until)}.`;
      statusNext.textContent = `Starts: ${formatDateTime(upcoming.start)}`;
    } else {
      statusDetail.textContent = "No upcoming interdorm sessions are scheduled.";
      statusNext.textContent = "Next session: --";
    }
  }

  statusUpdated.textContent = `Updated: ${formatDateTime(now)}`;
};

const fetchCalendarText = async () => {
  const localResponse = await fetch(encodeURI(LOCAL_CALENDAR_URL));
  if (localResponse.ok) {
    return localResponse.text();
  }

  const response = await fetch(REMOTE_CALENDAR_URL);
  if (response.ok) {
    return response.text();
  }

  const proxiedResponse = await fetch(
    `${CORS_PROXY_URL}${encodeURIComponent(REMOTE_CALENDAR_URL)}`
  );
  if (!proxiedResponse.ok) {
    throw new Error(`Calendar fetch failed: ${proxiedResponse.status}`);
  }
  return proxiedResponse.text();
};

const loadCalendar = async () => {
  statusDetail.textContent = "Loading calendar data…";

  try {
    const icsText = await fetchCalendarText();
    const rawEvents = parseIcs(icsText);
    const events = normalizeEvents(rawEvents).filter((event) =>
      INTERDORM_REGEX.test(event.summary)
    );

    renderEvents(events);
    updateStatus(events);

    return events;
  } catch (error) {
    statusValue.textContent = "Status unavailable";
    statusValue.classList.remove("on", "off");
    statusDetail.textContent =
      "Unable to load the calendar feed. Check your connection or the calendar URL.";
    statusNext.textContent = "Next session: --";
    statusUpdated.textContent = `Updated: ${formatDateTime(new Date())}`;

    eventList.innerHTML = "";
    const errorItem = document.createElement("li");
    errorItem.className = "event-placeholder";
    errorItem.textContent = "Calendar feed could not be loaded.";
    eventList.appendChild(errorItem);

    return [];
  }
};

let cachedEvents = [];

const refresh = async () => {
  cachedEvents = await loadCalendar();
};

const tick = () => {
  if (cachedEvents.length) {
    updateStatus(cachedEvents);
  }
};

refresh();
setInterval(refresh, 15 * 60 * 1000);
setInterval(tick, 60 * 1000);
