
const $ = id => document.getElementById(id);

const form = $("transactionForm");
const titleInput = $("title");
const amountInput = $("amount");
const typeInput = $("type");
const categoryInput = $("category");
const dateInput = $("date");

const STORAGE_KEY = "smartExpenseTransactions";
const BUDGET_KEY = "smartExpenseBudgets";
const THEME_KEY = "smartExpenseTheme";

const categories = [
    "Food", "Travel", "Shopping", "Education",
    "Bills", "Health", "Entertainment", "Other"
];

let transactions = loadData(STORAGE_KEY);
let budgets = loadData(BUDGET_KEY);
let editingId = null;
let incomeChart = null;
let categoryChart = null;

function loadData(key) {
    try {
        const data = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

// Keep only valid transaction records.
transactions = transactions.filter(t =>
    t &&
    typeof t.id === "string" &&
    typeof t.title === "string" &&
    Number.isFinite(t.amount) &&
    t.amount > 0 &&
    ["income", "expense"].includes(t.type) &&
    typeof t.category === "string" &&
    typeof t.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
    !Number.isNaN(Date.parse(t.date + "T00:00:00"))
);

budgets = budgets.filter(b =>
    b &&
    typeof b.category === "string" &&
    Number.isFinite(b.amount) &&
    b.amount > 0
);

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
        localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets));
        return true;
    } catch {
        alert("Unable to save data. Browser storage may be full or disabled.");
        return false;
    }
}

function money(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR"
    }).format(value);
}

function today() {
    const now = new Date();
    const local = new Date(
        now.getTime() - now.getTimezoneOffset() * 60000
    );
    return local.toISOString().slice(0, 10);
}

dateInput.value = today();

function updateSummary() {
    const income = transactions
        .filter(t => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);

    const expenses = transactions
        .filter(t => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);

    $("income").textContent = money(income);
    $("expenses").textContent = money(expenses);
    $("balance").textContent = money(income - expenses);
}

function getFilteredTransactions() {
    const query = $("search").value.trim().toLowerCase();
    const type = $("filterType").value;
    const category = $("filterCategory").value;
    const from = $("fromDate").value;
    const to = $("toDate").value;
    const sort = $("sort").value;

    const result = transactions.filter(t =>
        t.title.toLowerCase().includes(query) &&
        (type === "all" || t.type === type) &&
        (category === "all" || t.category === category) &&
        (!from || t.date >= from) &&
        (!to || t.date <= to)
    );

    result.sort((a, b) => {
        if (sort === "oldest") return a.date.localeCompare(b.date);
        if (sort === "high") return b.amount - a.amount;
        if (sort === "low") return a.amount - b.amount;
        return b.date.localeCompare(a.date);
    });

    return result;
}

function displayTransactions() {
    const list = $("transactionList");
    list.replaceChildren();

    const filtered = getFilteredTransactions();

    if (filtered.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "No matching transactions found.";
        list.appendChild(empty);
        return;
    }

    filtered.forEach(t => {
        const row = document.createElement("div");
        row.className = "transaction";

        const info = document.createElement("div");
        info.className = "transaction-info";

        const title = document.createElement("p");
        title.textContent = t.title;

        const details = document.createElement("small");
        details.textContent = `${t.category} | ${t.date} | ${t.type}`;

        info.append(title, details);

        const actions = document.createElement("div");
        actions.className = "transaction-actions";

        const amount = document.createElement("strong");
        amount.className = t.type === "income" ? "green" : "red";
        amount.textContent =
            `${t.type === "income" ? "+" : "-"}${money(t.amount)}`;

        const edit = document.createElement("button");
        edit.className = "edit-btn";
        edit.textContent = "Edit";
        edit.addEventListener("click", () => editTransaction(t.id));

        const remove = document.createElement("button");
        remove.className = "delete-btn";
        remove.textContent = "Delete";
        remove.addEventListener("click", () => deleteTransaction(t.id));

        actions.append(amount, edit, remove);
        row.append(info, actions);
        list.appendChild(row);
    });
}

form.addEventListener("submit", event => {
    event.preventDefault();

    const title = titleInput.value.trim();
    const amount = Number(amountInput.value);
    const type = typeInput.value;
    const category = categoryInput.value;
    const date = dateInput.value;

    if (
        !title ||
        title.length > 150 ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !["income", "expense"].includes(type) ||
        !date ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(date + "T00:00:00"))
    ) {
        alert("Please enter valid transaction details.");
        return;
    }

    const transaction = {
        id: editingId || crypto.randomUUID(),
        title,
        amount,
        type,
        category,
        date
    };

    const oldTransactions = [...transactions];

    if (editingId) {
        transactions = transactions.map(t =>
            t.id === editingId ? transaction : t
        );
    } else {
        transactions.push(transaction);
    }

    if (!saveData()) {
        transactions = oldTransactions;
        return;
    }

    cancelEdit();
    renderApp();
});

function editTransaction(id) {
    const t = transactions.find(item => item.id === id);
    if (!t) return;

    editingId = id;
    titleInput.value = t.title;
    amountInput.value = t.amount;
    typeInput.value = t.type;
    categoryInput.value = t.category;
    dateInput.value = t.date;

    $("formHeading").textContent = "Edit Transaction";
    $("submitBtn").textContent = "Save Changes";
    $("cancelEdit").classList.remove("hidden");

    form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelEdit() {
    editingId = null;
    form.reset();
    dateInput.value = today();
    $("formHeading").textContent = "Add Transaction";
    $("submitBtn").textContent = "Add Transaction";
    $("cancelEdit").classList.add("hidden");
}

$("cancelEdit").addEventListener("click", cancelEdit);

function deleteTransaction(id) {
    if (!confirm("Are you sure you want to delete this transaction?")) {
        return;
    }

    const oldTransactions = transactions;
    transactions = transactions.filter(t => t.id !== id);

    if (!saveData()) {
        transactions = oldTransactions;
        return;
    }

    if (editingId === id) cancelEdit();
    renderApp();
}

// Save a monthly budget for the selected category.
$("saveBudget").addEventListener("click", () => {
    const category = $("budgetCategory").value;
    const amount = Number($("budgetAmount").value);

    if (!Number.isFinite(amount) || amount <= 0) {
        alert("Enter a budget greater than zero.");
        return;
    }

    const oldBudgets = [...budgets];
    budgets = budgets.filter(b => b.category !== category);
    budgets.push({ category, amount });

    if (!saveData()) {
        budgets = oldBudgets;
        return;
    }

    $("budgetAmount").value = "";
    renderApp();
});

function renderBudgets() {
    const list = $("budgetList");
    list.replaceChildren();

    const month = today().slice(0, 7);

    if (budgets.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "Set a budget to track your spending.";
        list.appendChild(empty);
        return;
    }

    budgets.forEach(b => {
        const spent = transactions
            .filter(t =>
                t.type === "expense" &&
                t.category === b.category &&
                t.date.startsWith(month)
            )
            .reduce((sum, t) => sum + t.amount, 0);

        const percent = spent / b.amount * 100;

        const item = document.createElement("div");
        item.className = "budget-item";

        const heading = document.createElement("div");
        heading.className = "budget-heading";

        const name = document.createElement("strong");
        name.textContent = b.category;

        const amount = document.createElement("span");
        amount.textContent = `${money(spent)} / ${money(b.amount)}`;

        heading.append(name, amount);

        const track = document.createElement("div");
        track.className = "progress";

        const bar = document.createElement("div");
        bar.className = "progress-bar";
        if (percent >= 100) bar.classList.add("over");
        else if (percent >= 80) bar.classList.add("warning");

        bar.style.width = `${Math.min(percent, 100)}%`;
        track.appendChild(bar);

        const description = document.createElement("small");
        description.textContent = `${Math.round(percent)}% used`;

        const remove = document.createElement("button");
        remove.className = "delete-btn";
        remove.textContent = "Remove Budget";

        remove.addEventListener("click", () => {
            const oldBudgets = budgets;
            budgets = budgets.filter(x => x.category !== b.category);

            if (!saveData()) {
                budgets = oldBudgets;
                return;
            }
            renderApp();
        });

        item.append(heading, track, description, remove);
        list.appendChild(item);
    });
}

function renderAlerts() {
    const list = $("alerts");
    list.replaceChildren();
    const messages = [];
    const month = today().slice(0, 7);

    budgets.forEach(b => {
        const spent = transactions
            .filter(t =>
                t.type === "expense" &&
                t.category === b.category &&
                t.date.startsWith(month)
            )
            .reduce((sum, t) => sum + t.amount, 0);

        if (spent >= b.amount) {
            messages.push(
                `${b.category} budget exceeded! Spent ${money(spent)} of ${money(b.amount)}.`
            );
        } else if (spent >= b.amount * 0.8) {
            messages.push(
                `${b.category} budget warning: ${Math.round(spent / b.amount * 100)}% used.`
            );
        }
    });

    const expenses = transactions.filter(t => t.type === "expense");
    const income = transactions.filter(t => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);

    if (totalExpenses > income && expenses.length > 0) {
        messages.push("Your recorded expenses are greater than your income.");
    }

    if (messages.length === 0) {
        const p = document.createElement("p");
        p.textContent = "No alerts currently. Your finances are within set limits.";
        list.appendChild(p);
        return;
    }

    messages.forEach(message => {
        const alert = document.createElement("div");
        alert.className = "alert";
        alert.textContent = "⚠ " + message;
        list.appendChild(alert);
    });
}

function renderCharts() {
    if (typeof Chart === "undefined") return;
    const dark = document.body.classList.contains("dark");
    const chartTextColor = dark ? "#d8e9f5" : "#3c566f";
    const chartGridColor = dark ? "#29445d" : "#dbe5ed";

    const income = transactions
        .filter(t => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);

    const expenses = transactions
        .filter(t => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);

    const monthlyData = {};
    transactions.forEach(t => {
        const month = t.date.slice(0, 7);
        if (!monthlyData[month]) {
            monthlyData[month] = { income: 0, expense: 0 };
        }
        monthlyData[month][t.type] += t.amount;
    });

    const months = Object.keys(monthlyData).sort().slice(-6);

    if (incomeChart) incomeChart.destroy();
    if (categoryChart) categoryChart.destroy();

    incomeChart = new Chart($("incomeChart"), {
        type: "bar",
        data: {
            labels: ["Income", "Expenses"],
            datasets: [{
                label: "Amount (₹)",
                data: [income, expenses],
                backgroundColor: ["#25a875", "#ed6681"]
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: chartTextColor }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: chartGridColor },
                    ticks: { color: chartTextColor }
                }
            }
        }
    });

    const categoryTotals = {};
    transactions.filter(t => t.type === "expense")
        .forEach(t => {
            categoryTotals[t.category] =
                (categoryTotals[t.category] || 0) + t.amount;
        });

    const labels = Object.keys(categoryTotals);
    const values = labels.map(category => categoryTotals[category]);

    categoryChart = new Chart($("categoryChart"), {
        type: "doughnut",
        data: {
            labels: labels.length ? labels : ["No expenses"],
            datasets: [{
                data: values.length ? values : [1],
                backgroundColor: [
                    "#1c5a91", "#287fba", "#45afd0",
                    "#efaa48", "#25a875", "#556bcc",
                    "#ca6c53", "#628fc3", "#39a4a1"
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { color: chartTextColor }
                }
            }
        }
    });

    // Show the last six months in the chart's accessible title.
    $("incomeChart").setAttribute(
        "aria-label",
        "Income versus expenses. Recent months: " +
        months.map(m =>
            `${m}: income ${money(monthlyData[m].income)}, expenses ${money(monthlyData[m].expense)}`
        ).join("; ")
    );
}

function exportCSV() {
    const rows = getFilteredTransactions();
    if (rows.length === 0) {
        alert("There are no transactions to export.");
        return;
    }

    // Escape CSV values and prevent spreadsheet formula injection.
    function csvCell(value) {
        let text = String(value);
        if (/^[\s]*[=+\-@]/.test(text)) {
            text = "'" + text;
        }
        return '"' + text.replace(/"/g, '""') + '"';
    }

    const header = ["Description", "Amount", "Type", "Category", "Date"];
    const data = rows.map(t => [
        t.title, t.amount.toFixed(2), t.type, t.category, t.date
    ]);

    const csv = [header, ...data]
        .map(row => row.map(csvCell).join(","))
        .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "expense-report.csv";
    link.click();
    URL.revokeObjectURL(url);
}

$("exportBtn").addEventListener("click", exportCSV);

// Update history whenever search, filters or sorting changes.
["search", "filterType", "filterCategory", "fromDate", "toDate", "sort"]
    .forEach(id => {
        $(id).addEventListener(
            id === "search" ? "input" : "change",
            displayTransactions
        );
    });

$("themeBtn").addEventListener("click", () => {
    document.body.classList.toggle("dark");
    const dark = document.body.classList.contains("dark");

    $("themeBtn").textContent = dark ? "☀️ Light Mode" : "🌙 Dark Mode";
    renderCharts();

    try {
        localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    } catch {}
});

try {
    if (localStorage.getItem(THEME_KEY) === "dark") {
        document.body.classList.add("dark");
        $("themeBtn").textContent = "☀️ Light Mode";
    }
} catch {}

function renderApp() {
    updateSummary();
    displayTransactions();
    renderBudgets();
    renderAlerts();
    renderCharts();
}

renderApp();
