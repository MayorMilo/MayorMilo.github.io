const groupInput = document.getElementById("group-input");
const saveGroupsButton = document.getElementById("save-groups");
const saveStatus = document.getElementById("save-status");
const groupList = document.getElementById("group-list");
const groupLabel = document.getElementById("group-label");
const weekRange = document.getElementById("week-range");
const weekDetail = document.getElementById("week-detail");
const groupCount = document.getElementById("group-count");
const rotationNote = document.getElementById("rotation-note");
const calendar = document.getElementById("calendar");
const prevWeekButton = document.getElementById("prev-week");
const nextWeekButton = document.getElementById("next-week");
const todayWeekButton = document.getElementById("today-week");
const dropStatus = document.getElementById("drop-status");

const STORAGE_KEYS = {
  groups: "dormDutyGroups",
  assignments: "dormDutyAssignments",
};

const DEFAULT_GROUPS = `Group 1: Alex, Andrew, Ashwin, Lawrence, Dimash
Group 2: Bella, Brooke, Carter, Elena, Jae
Group 3: Malik, Priya, Quinn, Sofia, Talia`;

const DUTY_TIME = "7:30–10:00 PM";

const formatDate = (date) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);

const formatRange = (start, end) =>
  `${formatDate(start)} – ${formatDate(end)}`;

const startOfWeek = (date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day);
  return copy;
};

const addDays = (date, amount) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
};

const getRotationBase = () => {
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  return startOfWeek(yearStart);
};

const parseGroups = (text) => {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const groups = [];

  for (const line of lines) {
    const match = line.match(/^Group\s*(\d+)\s*:\s*(.+)$/i);
    if (!match) {
      continue;
    }
    const groupNumber = Number(match[1]);
    const names = match[2]
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);

    if (names.length) {
      groups.push({
        number: groupNumber,
        names,
      });
    }
  }

  return groups.slice(0, 5);
};

const loadGroups = () => {
  const saved = localStorage.getItem(STORAGE_KEYS.groups);
  const content = saved || DEFAULT_GROUPS;
  groupInput.value = content;
  return parseGroups(content);
};

const saveGroups = () => {
  const content = groupInput.value.trim() || DEFAULT_GROUPS;
  localStorage.setItem(STORAGE_KEYS.groups, content);
  saveStatus.textContent = "Groups saved.";
  window.setTimeout(() => {
    saveStatus.textContent = "";
  }, 2000);
  return parseGroups(content);
};

const loadAssignments = () => {
  const raw = localStorage.getItem(STORAGE_KEYS.assignments);
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
};

const saveAssignments = (assignments) => {
  localStorage.setItem(STORAGE_KEYS.assignments, JSON.stringify(assignments));
};

const assignments = loadAssignments();
let groups = loadGroups();
let currentWeekStart = startOfWeek(new Date());

const getWeekKey = (weekStart) => weekStart.toISOString().split("T")[0];

const getWeekAssignments = (weekStart) => {
  const key = getWeekKey(weekStart);
  return assignments[key] || {};
};

const setWeekAssignment = (weekStart, dayIndex, name) => {
  const key = getWeekKey(weekStart);
  const weekAssignments = assignments[key] || {};
  weekAssignments[dayIndex] = name;
  assignments[key] = weekAssignments;
  saveAssignments(assignments);
};

const removeWeekAssignment = (weekStart, dayIndex) => {
  const key = getWeekKey(weekStart);
  const weekAssignments = assignments[key] || {};
  delete weekAssignments[dayIndex];
  assignments[key] = weekAssignments;
  saveAssignments(assignments);
};

const getGroupForWeek = (weekStart) => {
  if (!groups.length) {
    return null;
  }
  const base = getRotationBase();
  const diffMs = weekStart - base;
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  const index = ((diffWeeks % groups.length) + groups.length) % groups.length;
  return groups[index];
};

const updateGroupPanel = () => {
  groupList.innerHTML = "";
  const currentGroup = getGroupForWeek(currentWeekStart);

  if (!currentGroup) {
    groupLabel.textContent = "Group --";
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Add group names to begin scheduling.";
    groupList.appendChild(empty);
    return;
  }

  groupLabel.textContent = `Group ${currentGroup.number}`;

  currentGroup.names.forEach((name) => {
    const pill = document.createElement("div");
    pill.className = "name-pill";
    pill.textContent = name;
    pill.setAttribute("draggable", "true");
    pill.dataset.name = name;
    pill.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", name);
    });
    groupList.appendChild(pill);
  });
};

const updateWeekHeader = () => {
  const weekEnd = addDays(currentWeekStart, 6);
  weekRange.textContent = formatRange(currentWeekStart, weekEnd);
  weekDetail.textContent = `Duty runs ${DUTY_TIME} Sunday–Friday.`;
  groupCount.textContent = `Groups loaded: ${groups.length}`;
  const rotationBase = getRotationBase();
  rotationNote.textContent = `Rotation base: ${formatDate(rotationBase)}`;
};

const createAssignment = (name, onRemove) => {
  const wrapper = document.createElement("div");
  wrapper.className = "assignment";
  const label = document.createElement("span");
  label.textContent = name;
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "Remove assignment");
  button.textContent = "×";
  button.addEventListener("click", onRemove);
  wrapper.appendChild(label);
  wrapper.appendChild(button);
  return wrapper;
};

const renderCalendar = () => {
  calendar.innerHTML = "";
  const weekAssignments = getWeekAssignments(currentWeekStart);

  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    const date = addDays(currentWeekStart, dayIndex);
    const isSaturday = dayIndex === 6;

    const day = document.createElement("div");
    day.className = "day";

    const header = document.createElement("div");
    header.className = "day-header";

    const title = document.createElement("div");
    title.className = "day-title";
    title.textContent = new Intl.DateTimeFormat(undefined, {
      weekday: "long",
    }).format(date);

    const dateLabel = document.createElement("div");
    dateLabel.className = "day-date";
    dateLabel.textContent = formatDate(date);

    const time = document.createElement("div");
    time.className = "day-time";
    time.textContent = isSaturday ? "No duty (weekend)" : DUTY_TIME;

    header.appendChild(title);
    header.appendChild(dateLabel);
    header.appendChild(time);

    const dropzone = document.createElement("div");
    dropzone.className = "dropzone";

    const assignedName = weekAssignments[dayIndex];
    if (assignedName) {
      dropzone.innerHTML = "";
      const assignment = createAssignment(assignedName, () => {
        removeWeekAssignment(currentWeekStart, dayIndex);
        renderCalendar();
        dropStatus.textContent = `Removed ${assignedName} from ${title.textContent}.`;
      });
      dropzone.appendChild(assignment);
    } else {
      dropzone.textContent = isSaturday
        ? "No duty sign-up"
        : "Drop a senior here";
    }

    if (!isSaturday) {
      dropzone.addEventListener("dragover", (event) => {
        event.preventDefault();
        day.classList.add("drag-over");
      });

      dropzone.addEventListener("dragleave", () => {
        day.classList.remove("drag-over");
      });

      dropzone.addEventListener("drop", (event) => {
        event.preventDefault();
        day.classList.remove("drag-over");
        const name = event.dataTransfer.getData("text/plain");
        if (!name) {
          return;
        }
        if (weekAssignments[dayIndex]) {
          dropStatus.textContent = `Only one senior per night. ${title.textContent} is already taken.`;
          return;
        }
        setWeekAssignment(currentWeekStart, dayIndex, name);
        renderCalendar();
        dropStatus.textContent = `${name} assigned to ${title.textContent}.`;
      });
    }

    day.appendChild(header);
    day.appendChild(dropzone);
    calendar.appendChild(day);
  }
};

const renderAll = () => {
  updateWeekHeader();
  updateGroupPanel();
  renderCalendar();
};

saveGroupsButton.addEventListener("click", () => {
  groups = saveGroups();
  renderAll();
});

prevWeekButton.addEventListener("click", () => {
  currentWeekStart = addDays(currentWeekStart, -7);
  renderAll();
});

nextWeekButton.addEventListener("click", () => {
  currentWeekStart = addDays(currentWeekStart, 7);
  renderAll();
});

todayWeekButton.addEventListener("click", () => {
  currentWeekStart = startOfWeek(new Date());
  renderAll();
});

renderAll();
