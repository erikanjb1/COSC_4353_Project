/*mock data*/ 

const state = {
    view: "dashboard",
    selectedServiceId: null,
    editingServiceId: null,
    nowServing: {},
    services: [
        {
            id: "s1", name: "General Advising",
            description: "Walk-in",
            duration: 15,
            priority: "medium",
            status: "open",
            queue: [
                {id: "t1", ticket: "A-101", name: "Visitor A", joinedAt: "9:02 AM"},
                {id: "t2", ticket: "A-102", name: "Visitor B", joinedAt: "9:08 AM"},
                {id: "t3", ticket: "A-103", name: "Visitor C", joinedAt: "9:13 AM"},
            ],
        },
        {
            id: "s2", name: "Financial Aid",
            description: "Aid applications",
            duration: 20,
            priority: "high",
            status: "open",
            queue: [
                {id: "t4", ticket: "A-104", name: "Visitor D", joinedAt: "9:00 AM"},
                {id: "t5", ticket: "A-105", name: "Visitor E", joinedAt: "9:24 AM"},
                {id: "t6", ticket: "A-106", name: "Visitor F", joinedAt: "9:34 AM"},
            ],
        },
        {
            id: "s3", name: "ID service",
            description: "Issue and replacing",
            duration: 6,
            priority: "low",
            status: "open",
            queue: [
                {id: "t7", ticket: "A-107", name: "Visitor G", joinedAt: "9:01 AM"},
                {id: "t8", ticket: "A-108", name: "Visitor H", joinedAt: "9:12 AM"},
                {id: "t9", ticket: "A-109", name: "Visitor I", joinedAt: "9:54 AM"},
            ],
        },
        {
            id: "s4", name: "Records",
            description: "Record request",
            duration: 13,
            priority: "medium",
            status: "closed",
            queue:[],
        },
    ],
}

state.selectedServiceId = state.services[0].id;
let idCounter = 100;
const nextId = (p) => p + idCounter++;

/* helpers */
const $app = document.getElementById("app");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
const getService = (id) => state.services.find((s) => s.id === id);
const totalWaiting = () => state.services.reduce((sum, s) => sum + s.queue.length, 0);
const openCount = () => state.services.filter((s) => s.status === "open").length;
const longestWait = () => state.services.reduce((max, s) => Math.max(max, s.queue.length * s.duration), 0);

function showNotification(msg){
    const t = document.getElementById("notification");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2600);
}


/*stuff for topbar*/
function updateTopbar() {
    const labels = {dashboard: "Dashboard", services: "Manage Services", queue: "Queue Management"};
    document.getElementById("breadcrumb_page").textContent = labels[state.view] || "";
    document.getElementById("topbar_badge_text").textContent = `${openCount()} service${openCount() !== 1 ? "s" : ""} open · ${totalWaiting()} waiting`;
}

function updateSidebarActive() {
    document.querySelectorAll(".nav_item[data-view]").forEach((el) => {
        el.classList.toggle("is_active", el.dataset.view === state.view);
    });
}

function setView(view, opts = {}) {
    state.view = view;
    if (opts.serviceId) state.selectedServiceId = opts.serviceId;
    if (view !== "services") state.editingServiceId = null;
    updateTopbar();
    updateSidebarActive();
    render();
}

function render() {
    if (state.view === "dashboard") renderDashboard();
    if (state.view === "services") renderServices();
    if (state.view === "queue") renderQueue();
}

/*Dashboard*/
function renderDashboard() {
    const cards = state.services.map((s) => `
        <div class="service_card">
            <div class="service_card_top">
                <div>
                    <div class="service_card_name">${esc(s.name)}</div>
                    <div class="service_card_desc">${esc(s.description)}</div>
                </div>
                <span class="status_pill ${s.status === "open" ? "pill_open" : "pill_closed"}">
                    <span class="dot"></span>${cap(s.status)}
                </span>
            </div>
            <div class="service_card_meta">
                <div class="meta_item">
                    <span class="meta_label">Waiting</span>
                    <span class="meta_val">${s.queue.length}</span>
                </div>
                <div class="meta_item">
                    <span class="meta_label">Avg. time</span>
                    <span class="meta_val">${s.duration}m</span>
                </div>
                <div class="meta_item">
                    <span class="meta_label">Est. wait</span>
                    <span class="meta_val">${s.queue.length * s.duration}m</span>
                </div>
                <div class="meta_item">
                    <span class="meta_label">Priority</span>
                    <span class="priority_badge priority_${s.priority}">${cap(s.priority)}</span>
                </div>
            </div>
            <div class="service_card_footer">
                <button class="btn btn_sm" data-action="toggle_status" data-id="${s.id}">
                    ${s.status === "open" ? "Close queue" : "Reopen queue"}
                </button>
                <div class="btn_row">
                    <button class="btn btn_sm" data-action="edit_svc_from_dash" data-id="${s.id}">Edit</button>
                    <button class="btn btn_sm btn_primary" data-action="go_queue" data-id="${s.id}">Manage queue -></button>
                </div>
            </div>
        </div>`).join("");

    $app.innerHTML = `
        <div class="page_header">
            <div class="page_header_row">
                <div>
                    <h1 class="page_title">Dashboard</h1>
                    <p class="page_subtitle">Live overview</p>
                </div>
            </div>
        </div>
        <div class="stat_grid">
            <div class="stat_card">
                <div class="stat_eyebrow">Services</div>
                <div class="stat_value">${openCount()}<span>/${state.services.length} open</span></div>
                <div class="stat_meta">${state.services.length - openCount()} closed</div>
            </div>
            <div class="stat_card">
                <div class="stat_eyebrow">People waiting</div>
                <div class="stat_value">${totalWaiting()}</div>
                <div class="stat_meta">Across all queues</div>
            </div>
            <div class="stat_card">
                <div class="stat_eyebrow">Longest wait</div>
                <div class="stat_value">${longestWait()}<span>min</span></div>
                <div class="stat_meta">Worst-case projection</div>
            </div>
        </div>
        <div class="section_heading">All services</div>
        <div class="service_grid">${cards || `<div class="empty_state"><div class="empty_title">No services yet</div><div class="empty_body">Go to Manage Services to create your first one.</div></div>`}</div>
    `;
}

/*Services*/
function renderServices() {
    const editing = state.editingServiceId ? getService(state.editingServiceId) : null;
    const f = editing || {name: "", description: "", duration: "", priority: "medium"};
    const rows = state.services.length ? state.services.map((s) => `
        <div class="svc_row">
            <div>
                <div class="svc_row_name">${esc(s.name)}</div>
                <div class="svc_row_desc">${esc(s.description)}</div>
            </div>
            <div>
                <span class="priority_badge priority_${s.priority}">${cap(s.priority)}</span>
            </div>
            <div style="font-family:'IBM Plex Mono',monospace; font-size:13px; font-weight:600">${s.duration}m</div>
            <div class="svc_row_actions">
                <button class="btn btn_sm" data-action="edit_service" data-id="${s.id}">Edit</button>
                <button class="btn btn_sm btn_danger" data-action="delete_service" data-id="${s.id}">Delete</button>
            </div>
        </div>`).join("")
    : `<div class="empty_state" style="border-radius:0; border:none; border-top: 1px solid rgb(229, 231, 235)">
            <div class="empty_title">No services yet</div>
            <div class="empty_body">Use form to create first service</div>
       </div>`;
    $app.innerHTML =`
    <div class="page_header">
        <div class="page_header_row">
            <div>
                <h1 class="page_title">${editing ? "Edit Service" : "Manage Services"}</h1>
                <p class="page_subtitle">${editing ? `Editing "${esc(editing.name)}"`:"Create, edit, or remove services"}</p>
            </div>
        </div>
    </div>
    <div class="two_col">
        <div class="card">
            <div class="card_header">
                <div class="card_title">${editing ? "Edit Service" : "New Service"}</div>
                <div class="card_sub">${editing ? "Update the fields below and save." : "All fields are required."}</div>
            </div>
            <form id="service_form" novalidate>
                <div class="card_body">
                    <div class="field" data-field="name">
                        <label for="f_name"><span>Service name <span class="required_marker" aria-hidden="true">*</span></span><span class="hint" id="name_count">${f.name.length}/20</span></label>
                        <input id="f_name" name="name" type="text" maxlength="20" value="${esc(f.name)}" placeholder="e.g. General Advising" autocomplete="off" required />
                        <div class="field_error" hidden></div>
                    </div>
                    <div class="field" data-field="description">
                        <label for="f_desc"><span>Description <span class="required_marker" aria-hidden="true">*</span></span><span class="hint" id="desc_count">${f.description.length}/30</span></label>
                        <textarea id="f_desc" name="description" maxlength="30" placeholder="What happens during this service?" required>${esc(f.description)}</textarea>
                        <div class="field_error" hidden></div>
                    </div>
                    <div class="field" data-field="duration">
                        <label for="f_duration"><span>Expected duration <span class="required_marker" aria-hidden="true">*</span></span><span class="hint">minutes</span></label>
                        <input id="f_duration" name="duration" type="number" min="1" step="1" value="${esc(f.duration)}" placeholder="e.g. 15" required />
                        <div class="field_error" hidden></div>
                    </div>
                    <div class="field" data-field="priority">
                        <label for="f_priority">Priority level</label>
                        <select id="f_priority" name="priority">
                            <option value="low" ${f.priority === "low" ? "selected" : ""}>Low</option>
                            <option value="medium" ${f.priority === "medium" ? "selected" : ""}>Medium</option>
                            <option value="high" ${f.priority === "high" ? "selected" : ""}>High</option>
                        </select>
                    </div>
                </div>
                <div class="form_footer">
                    <button type="submit" class="btn btn_primary">${editing ? "Save changes" : "Create service"}</button>
                    ${editing ? `<button type="button" class="btn btn_ghost" data-action="cancel_edit">Cancel</button>` : ""}
                </div>
            </form>
        </div>
        <div>
            <div class="svc_table">
                <div class="svc_table_header">
                    <div>Service</div>
                    <div>Priority</div>
                    <div>Duration</div>
                    <div>Action</div>
                </div>
                ${rows}
            </div>
        </div>
    </div>`;

    const nameInput = document.getElementById("f_name");
    const nameCount = document.getElementById("name_count");
    nameInput.addEventListener("input", () => {nameCount.textContent = `${nameInput.value.length}/20`;});
    const descInput = document.getElementById("f_desc");
    const descCount = document.getElementById("desc_count");
    descInput.addEventListener("input", () => {descCount.textContent = `${descInput.value.length}/30`;});
    document.getElementById("service_form").addEventListener("submit", onServiceSubmit);
}

function setFieldError(fieldName, message){
    const wrap = document.querySelector(`[data-field="${fieldName}"]`);
    if (!wrap){
        return;
    };
    const err = wrap.querySelector(".field_error");
    if (message){
        wrap.classList.add("has_error");
        err.hidden = false;
        err.textContent = message;
    }
    else {
        wrap.classList.remove("has_error");
        err.hidden = true;
        err.textContent = "";
    }
}

function onServiceSubmit(e){
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = fd.get("name").trim();
    const description = fd.get("description").trim();
    const durationRaw = fd.get("duration");
    const duration = parseInt(durationRaw, 10);
    const priority = fd.get("priority");

    let valid = true;
    if(!name){
        setFieldError("name", "Service name is required.");
        valid = false;
    }
    else if(name.length > 20){
        setFieldError("name", "Must be 20 characters or less.");
        valid = false;
    }
    else if(description.length > 30){
        setFieldError("description", "Description must be 30 characters or less.");
        valid = false;
    }
    else{
        setFieldError("name", null);
    }

    if(!description){
        setFieldError("description", "Description is required");
        valid = false;
    }
    else{
        setFieldError("description", null);
    }

    if(!durationRaw || isNaN(duration) || duration <= 0){
        setFieldError("duration", "Enter number greater than 0");
        valid = false;
    }
    else{
        setFieldError("duration", null);
    }

    if(!valid){
        return;
    }

    if(state.editingServiceId){
        Object.assign(getService(state.editingServiceId), {name, description, duration, priority})
        showNotification(`Saved "${name}"`);
        state.editingServiceId = null;
    }
    else{
        state.services.push({id: nextId("s"), name, description, duration, priority, status: "open", queue: []});
        showNotification(`"${name}" created`);
    }
    renderServices();
    updateTopbar();
}

function renderQueue(){
    if(!getService(state.selectedServiceId) && state.services.length){
        state.selectedServiceId = state.services[0].id;
    }
    const svc = getService(state.selectedServiceId);

    if(!svc){
        $app.innerHTML = `
            <div class="page_header">
                <h1 class="page_title">Queue Management</h1>
            </div>
            <div class="empty_state">
                <div class="empty_title">No services yet</div>
                <div class="empty_body">Create service in Services</div>
            </div>`;
            return;
    }

    const options = state.services.map((s) =>
        `<option value="${s.id}" ${s.id === state.selectedServiceId ? "selected" : ""}>${esc(s.name)} (${s.queue.length} waiting)</option>`
    ).join("");

    const qRows = svc.queue.length ? svc.queue.map((entry, i)=>`
        <div class="queue_row" data-row-id="${entry.id}">
            <div class="q_pos">#${i + 1}</div>
            <div class="q_ticket">${esc(entry.ticket)}</div>
            <div>
                <div class="q_name">${esc(entry.name)}</div>
                <div class="q_joined">Joined ${esc(entry.joinedAt)}</div>
            </div>
            <div class="q_wait">~${i * svc.duration}</div>
            <div class="q_actions">
                <button class="icon_btn" data-action="move_up" data-index="${i}" ${i === 0 ? "disabled":""} title="Move up">▲</button>
                <button class="icon_btn" data-action="move_down" data-index="${i}" ${i === svc.queue.length -1 ? "disabled":""} title="Move down">▼</button>
                <button class="icon_btn is_danger" data-action="remove_entry" data-index="${i}" title="Removed">X</button>
            </div>
        </div>`).join("")
        :`<div class="empty_state" style="border-radius:0; border:none">
            <div class="empty_title">Queue is empty</div>
            <div class="empty_body">No visitors are waiting</div>
        </div>`;
    
    const lastServed = state.nowServing[svc.id];

    $app.innerHTML =`
        <div class="page_header">
            <div class="page_header_row">
                <div>
                    <h1 class="page_title">Queue Management</h1>
                    <p class="page_subtitle">Monitor and manage the live queue for each service.</p>
                </div>
                <div class="page_actions">
                    <span class="status_pill ${svc.status === "open" ? "pill_open" : "pill_closed"}">
                        <span class="dot"></span>
                        ${cap(svc.status)}
                    </span>
                </div>
            </div>
        </div>
        <div class="queue_page_grid">
            <div>
                <div class="queue_select_bar">
                    <label for="queue_service_select">Service</label>
                    <select id="queue_service_select">${options}</select>
                </div>
                <div class="now_serving_banner">
                    <div>
                        <div class="ns_eyebrow">Now serving</div>
                        <div class="ns_value">${lastServed || "-"}</div>
                    </div>
                    <button class="serve_btn" id="serve_next_btn" ${svc.queue.length === 0 ? "disabled" : ""}>Serve next -></button>
                </div>
                <div class="queue_list">
                    <div class="queue_list_header">
                        <div>#</div>
                        <div>Ticket</div>
                        <div>Visitor</div>
                        <div>Est. wait</div>
                        <div>Actions</div>
                    </div>
                    <div class="queue_items">${qRows}</div>
                </div>
            </div>
            <div class="info_card">
                <div class="info_card_header">
                    <div class="info_card_title">Service info</div>
                </div>
            <div class="info_card_body">
                <div class="info_row">
                    <span class="info_row_label">Service</span>
                    <span class="info_row_val" style="font-family:inherit; font-size: 13px; text-align: right">${esc(svc.name)}</span>
                </div>
                <hr class="info_divider"/>
                <div class="info_row">
                    <span class="info_row_label">Status</span>
                    <span class="status_pill ${svc.status === "open" ? "pill_open" : "pill_closed"}" style="font-size: 11px"><span class="dot"></span>${cap(svc.status)}</span>
                </div>
                <div class="info_row">
                    <span class="info_row_label">Priority</span>
                    <span class="priority_badge priority_${svc.priority}" style="font-size: 11px">${cap(svc.priority)}</span>
                </div>
                <hr class="info_divider"/>
                <div class="info_row">
                    <span class="info_row_label">Waiting</span>
                    <span class="info_row_val">${svc.queue.length}</span>
                </div>
                <div class="info_row">
                    <span class="info_row_label">Avg. duration</span>
                    <span class="info_row_val">${svc.duration}m</span>
                </div>
                <div class="info_row">
                    <span class="info_row_label">Total est. wait</span>
                    <span class="info_row_val">${svc.queue.length * svc.duration}m</span>
                </div>
                <hr class="info_border"/>
                <button class="btn btn_sm" data-action="toggle_status" data-id="${svc.id}" style="width: 100%; justify-content: center">
                    ${svc.status === "open" ? "Close this queue" : "Reopen this queue"}
                </button>
            </div>
        </div>
    </div>`;

    document.getElementById("queue_service_select").addEventListener("change", (e) =>{
        state.selectedServiceId = e.target.value;
        renderQueue()
    });
    document.getElementById("serve_next_btn").addEventListener("click", () => serveNext(svc.id));
}

function serveNext(serviceId){
    const svc = getService(serviceId);
    if(!svc.queue.length){
        return;
    }

    const served = svc.queue[0];
    const row = document.querySelector(`[data-row-id="${served.id}"]`);
    const finish = () =>{
        svc.queue.shift();
        state.nowServing[serviceId] = `${served.ticket} - ${served.name}`;
        renderQueue();
        updateTopbar();
        showNotification(`Now serving ${served.ticket}`);
    };
    
    if(row){
        row.classList.add("is_leaving");
        setTimeout(finish, 200);
    }
    else{
        finish();
    }
}

function moveQueueItem(serviceId, index, dir){
    const svc = getService(serviceId);
    const target = index + dir;
    if(target < 0 || target >= svc.queue.length){
        return;
    }

    const [items] = svc.queue.splice(index, 1);
    svc.queue.splice(target, 0, items);
    renderQueue();
}

function removeQueueItem(serviceId, index){
    getService(serviceId).queue.splice(index, 1);
    renderQueue();
    updateTopbar();
    showNotification("Removed from queue");
}

/*custom popup */

const modalHTML = `
    <div class="modal_overlay" id="modal_overlay">
        <div class="modal" role="dialog">
            <div class="modal_icon">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 7v5M11 15h.01" 
                stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9.26 3.5L2 17a2 2 0 001.74 3h14.52A2 2 0 0020 17L12.74 3.5a2 2 0 00-3.48 0z" 
                stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
            </svg>
            </div>
            <div class="modal_body">
                <div class="modal_title" id="modal_title">Are you sure?</div>
                <div class="modal_message" id="modal_message"></div>
            </div>
            <div class="modal_actions">
                <button class="btn" id="modal_cancel">Cancel</button>
                <button class="btn btn_danger" id="modal_confirm">Confirm</button>
            </div>
        </div>
    </div>`;
document.body.insertAdjacentHTML("beforeend", modalHTML)

let modalCallback = null;
const modalOverlay = document.getElementById("modal_overlay");

function showModal(message, onConfirm){
    document.getElementById("modal_message").textContent = message;
    modalCallback = onConfirm;
    modalOverlay.classList.add("is_open");
}

document.getElementById("modal_confirm").addEventListener("click", () => {
    modalOverlay.classList.remove("is_open");
    if (modalCallback) { modalCallback(); modalCallback = null; }
  });

  document.getElementById("modal_cancel").addEventListener("click", () => {
    modalOverlay.classList.remove("is_open");
    modalCallback = null;
  });

modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.classList.remove("is_open");
      modalCallback = null;
    }
  });

document.addEventListener("click", (e) => {
    const navItem = e.target.closest(".nav_item[data-view]");
    if(navItem){
        e.preventDefault();
        setView(navItem.dataset.view);
        return;
    }

    const el = e.target.closest("[data-action]");
    if(!el){
        return;
    }

    const {action, id} = el.dataset;
    const index = el.dataset.index !== undefined ? parseInt(el.dataset.index, 10) : null;

    switch(action) {
        case "toggle_status":{
            const s = getService(id);
            s.status = s.status === "open" ? "closed" : "open";
            showNotification(`${s.name} ${s.status === "open" ? "reopened" : "closed"}`);
            updateTopbar();
            render();
            break;
        }

        case "go_queue":{
            setView("queue", {serviceId: id});
            break;
        }

        case "edit_svc_from_dash":{
            state.editingServiceId = id;
            setView("services");
            break;
        }

        case "edit_service":{
            state.editingServiceId = id;
            renderServices();
            break;
        }

        case "cancel_edit":{
            state.editingServiceId = null;
            renderServices();
            break;
        }

        case "delete_service":{
            const s = getService(id);
            showModal(`Delete "${s.name}"? This can't be undone.`, () => {
                state.services = state.services.filter((x) => x.id !== id);
                if(state.selectedServiceId === id && state.services.length){
                    state.selectedServiceId = state.services[0].id;
                }
                showNotification(`"${s.name}" deleted`);
                updateTopbar();
                renderServices();
            });
            break;
        }
        case "move_up":{
            moveQueueItem(state.selectedServiceId, index, -1); 
            break;
        }

        case "move_down":{
            moveQueueItem(state.selectedServiceId, index, +1);
            break;
        }
        case "remove_entry":{
            removeQueueItem(state.selectedServiceId, index);
            break;
        }
    }
});


setView("dashboard");
