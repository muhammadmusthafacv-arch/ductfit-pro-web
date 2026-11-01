/**
 * DuctFit Pro - Client-Side Engineering PDF Report Generator
 * High-performance, offline & static Netlify compliant report generator.
 * Produces publication-grade ASHRAE Fundamentals (Ch. 21) duct reports:
 *  - Project Duct Fitting Schedule & ESP Pressure Loss Analysis
 *  - Auto Duct Sizer Sizing Schedule & Friction Loss Analysis
 *  - Individual Fitting Calculation Breakdown Reports
 * Powered by html2pdf.js, KaTeX, and standard vector print layout.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.DuctFitPdfReport = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function escapeHtml(str) {
        if (str === null || str === undefined) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function numStr(val, dec = 1, defaultVal = "0.0") {
        if (val === null || val === undefined || val === "" || isNaN(val)) return defaultVal;
        const n = Number(val);
        return n.toFixed(dec);
    }

    function cleanLatexMath(latex) {
        if (!latex) return "";
        let s = String(latex).trim();
        // Remove enclosing dollar signs if present
        if (s.startsWith("$$") && s.endsWith("$$")) s = s.slice(2, -2).trim();
        else if (s.startsWith("$") && s.endsWith("$")) s = s.slice(1, -1).trim();
        else if (s.startsWith("\\[") && s.endsWith("\\]")) s = s.slice(2, -2).trim();
        else if (s.startsWith("\\(") && s.endsWith("\\)")) s = s.slice(2, -2).trim();
        return s;
    }

    function renderMath(formula, displayMode = false) {
        const cleaned = cleanLatexMath(formula);
        if (!cleaned) return "";
        if (typeof window !== "undefined" && window.katex && typeof window.katex.renderToString === "function") {
            try {
                return window.katex.renderToString(cleaned, {
                    displayMode: displayMode,
                    throwOnError: false
                });
            } catch (e) {
                console.warn("KaTeX render error:", e);
            }
        }
        return `<code>${escapeHtml(cleaned)}</code>`;
    }

    async function waitForImages(element) {
        if (!element) return;
        const imgs = Array.from(element.querySelectorAll("img"));
        if (imgs.length === 0) return;
        const promises = imgs.map(img => {
            if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
            return new Promise(resolve => {
                const timer = setTimeout(() => {
                    resolve();
                }, 3000);
                img.onload = () => { clearTimeout(timer); resolve(); };
                img.onerror = () => {
                    clearTimeout(timer);
                    img.style.display = "none";
                    resolve();
                };
            });
        });
        await Promise.all(promises);
    }

    // Common CSS Styles for publication-quality reports
    const REPORT_CSS = `
        <style>
            .ductfit-pdf-root {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                font-size: 11px;
                line-height: 1.45;
                color: #0f172a;
                background: #ffffff;
                padding: 16px 20px;
                box-sizing: border-box;
                width: 794px; /* Standard A4 width at 96 DPI */
                margin: 0 auto;
            }
            .ductfit-pdf-root * {
                box-sizing: border-box;
            }
            .pdf-header-bar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 2px solid #0369a1;
                padding-bottom: 8px;
                margin-bottom: 12px;
            }
            .pdf-brand-title {
                font-size: 18px;
                font-weight: 800;
                color: #0369a1;
                letter-spacing: -0.5px;
                margin: 0;
            }
            .pdf-brand-sub {
                font-size: 9px;
                font-weight: 600;
                color: #64748b;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .pdf-standard-badge {
                text-align: right;
                font-size: 9px;
                color: #334155;
            }
            .pdf-standard-badge strong {
                color: #0369a1;
                font-size: 10px;
                display: block;
            }
            .pdf-doc-title {
                font-size: 14px;
                font-weight: 800;
                text-align: center;
                color: #0f172a;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                margin: 12px 0 10px 0;
            }
            .pdf-spec-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 10px;
                background: #f8fafc;
                border: 1px solid #cbd5e1;
                border-top: 2.5px solid #0369a1;
            }
            .pdf-spec-table td {
                padding: 4px 8px;
                border: 1px solid #e2e8f0;
                font-size: 9.5px;
            }
            .pdf-spec-label {
                font-weight: 700;
                color: #334155;
                width: 15%;
                background: #f1f5f9;
            }
            .pdf-spec-val {
                color: #0f172a;
                width: 35%;
            }
            .pdf-basis-box {
                background: #f0f9ff;
                border: 1px solid #bae6fd;
                border-radius: 4px;
                padding: 6px 10px;
                font-size: 9px;
                color: #0369a1;
                margin-bottom: 12px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .pdf-kpi-row {
                display: flex;
                gap: 8px;
                margin-bottom: 12px;
            }
            .pdf-kpi-card {
                flex: 1;
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-top: 3px solid #0284c7;
                border-radius: 4px;
                padding: 6px 8px;
                text-align: center;
            }
            .pdf-kpi-card.highlight {
                background: #f0fdf4;
                border-top-color: #16a34a;
            }
            .pdf-kpi-card.primary {
                background: #eff6ff;
                border-top-color: #0369a1;
            }
            .pdf-kpi-title {
                font-size: 8px;
                font-weight: 700;
                color: #64748b;
                text-transform: uppercase;
                letter-spacing: 0.4px;
                margin-bottom: 2px;
            }
            .pdf-kpi-value {
                font-size: 13px;
                font-weight: 800;
                color: #0f172a;
            }
            .pdf-schedule-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 12px;
                font-size: 9px;
            }
            .pdf-schedule-table th {
                background: #0f172a;
                color: #ffffff;
                padding: 6px 5px;
                font-weight: 700;
                text-align: left;
                border: 1px solid #0f172a;
                font-size: 8.5px;
                letter-spacing: 0.2px;
            }
            .pdf-schedule-table th.text-center { text-align: center; }
            .pdf-schedule-table th.text-right { text-align: right; }
            .pdf-schedule-table td {
                padding: 5px 5px;
                border: 1px solid #e2e8f0;
                vertical-align: middle;
            }
            .pdf-schedule-table tr:nth-child(even) td {
                background: #f8fafc;
            }
            .pdf-schedule-table td.text-center { text-align: center; }
            .pdf-schedule-table td.text-right { text-align: right; font-variant-numeric: tabular-nums; }
            .pdf-schedule-table tr.total-row td {
                background: #f1f5f9;
                font-weight: 700;
                border-top: 2px solid #94a3b8;
            }
            .pdf-schedule-table tr.margin-row td {
                background: #f8fafc;
                font-weight: 600;
                color: #475569;
            }
            .pdf-schedule-table tr.grand-total td {
                background: #e0f2fe;
                color: #0369a1;
                font-weight: 800;
                font-size: 10.5px;
                border-top: 2px solid #0284c7;
                border-bottom: 2.5px solid #0369a1;
            }
            .pdf-page-break {
                page-break-before: always !important;
                break-before: page !important;
                margin-top: 20px;
                padding-top: 15px;
                border-top: 1px dashed #cbd5e1;
            }
            .pdf-item-banner {
                background: #0369a1;
                color: #ffffff;
                padding: 6px 12px;
                font-size: 11px;
                font-weight: 700;
                border-radius: 4px;
                margin-bottom: 8px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .pdf-diagram-container {
                text-align: center;
                background: #ffffff;
                border: 1px solid #cbd5e1;
                border-radius: 4px;
                padding: 8px;
                margin-bottom: 10px;
                page-break-inside: avoid;
            }
            .pdf-diagram-container img {
                max-height: 180px;
                max-width: 440px;
                object-fit: contain;
                display: block;
                margin: 0 auto;
            }
            .pdf-io-grid {
                display: flex;
                gap: 10px;
                margin-bottom: 10px;
                page-break-inside: avoid;
            }
            .pdf-io-col {
                flex: 1;
                border: 1px solid #cbd5e1;
                border-radius: 4px;
                overflow: hidden;
            }
            .pdf-io-header {
                background: #f1f5f9;
                font-weight: 700;
                font-size: 9px;
                color: #334155;
                padding: 4px 8px;
                border-bottom: 1px solid #cbd5e1;
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }
            .pdf-io-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 9px;
            }
            .pdf-io-table td {
                padding: 3px 6px;
                border-bottom: 1px solid #f1f5f9;
            }
            .pdf-io-table tr:last-child td {
                border-bottom: none;
            }
            .pdf-io-table td.io-label {
                color: #475569;
                font-weight: 500;
                width: 60%;
            }
            .pdf-io-table td.io-val {
                color: #0f172a;
                font-weight: 700;
                text-align: right;
            }
            .pdf-calc-step-card {
                background: #ffffff;
                border: 1px solid #cbd5e1;
                border-left: 3.5px solid #0369a1;
                border-radius: 3px;
                padding: 7px 10px;
                margin-bottom: 8px;
                page-break-inside: avoid;
            }
            .pdf-step-title-row {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
                margin-bottom: 4px;
            }
            .pdf-step-label {
                font-weight: 700;
                color: #0369a1;
                font-size: 9.5px;
            }
            .pdf-step-citation {
                font-size: 8px;
                color: #64748b;
                font-style: italic;
            }
            .pdf-formula-row {
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 3px;
                padding: 5px 8px;
                margin-bottom: 5px;
                font-size: 9.5px;
            }
            .pdf-result-callout {
                background: #f0fdf4;
                border: 1px solid #bbf7d0;
                border-radius: 3px;
                padding: 4px 8px;
                font-weight: 700;
                color: #166534;
                font-size: 9.5px;
                display: flex;
                justify-content: space-between;
            }
            .pdf-footer-note {
                margin-top: 15px;
                border-top: 1px solid #e2e8f0;
                padding-top: 6px;
                font-size: 8px;
                color: #64748b;
                display: flex;
                justify-content: space-between;
            }
        </style>
    `;

    /**
     * Build HTML for Duct Fitting Schedule Master Report
     */
    function buildFittingReportHtml(project, options = {}) {
        const u = project.unit_system || "SI";
        const isSi = (u === "SI");
        const dpUnit = isSi ? "Pa" : "in. wg";
        const flowUnit = isSi ? "L/s" : "cfm";
        const velUnit = isSi ? "m/s" : "fpm";
        const pvUnit = isSi ? "Pa" : "in. wg";
        const densVal = isSi ? "1.204 kg/m³" : "0.075 lbm/ft³";
        const nowStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

        const fittings = project.fittings || [];
        const includeCalcs = Boolean(options.includeCalcs);
        const marginPct = Math.max(0, parseFloat(options.margin ?? project.margin_pct ?? project.design_margin ?? 10) || 0);

        let totalQty = 0;
        let cumDp = 0;
        fittings.forEach(f => {
            const q = Math.max(1, parseInt(f.qty || 1, 10));
            totalQty += q;
            const singleLoss = parseFloat(f.dp || 0) || 0;
            cumDp += (parseFloat(f.total_dp) || (singleLoss * q));
        });

        const marginDp = cumDp * (marginPct / 100.0);
        const totalDesignDp = cumDp + marginDp;

        // Schedule Table Rows
        let tableRowsHtml = "";
        fittings.forEach((fit, idx) => {
            const qty = Math.max(1, parseInt(fit.qty || 1, 10));
            const singleLoss = parseFloat(fit.dp || 0) || 0;
            const totLoss = parseFloat(fit.total_dp) || (singleLoss * qty);
            const coeff = fit.f_or_Co !== undefined ? fit.f_or_Co : (fit.coeff !== undefined ? fit.coeff : "-");
            const coeffType = fit.coeff_type || "C_o";
            const shapeStr = (fit.shape || "rect").toUpperCase();

            let lossDisplay = `${numStr(totLoss, 1)} ${dpUnit}`;
            if (qty > 1) {
                lossDisplay = `<span style="color:#64748b;font-size:8px;">(${numStr(singleLoss, 1)} &times; ${qty})</span><br/><b>${numStr(totLoss, 1)} ${dpUnit}</b>`;
            }

            tableRowsHtml += `
                <tr>
                    <td class="text-center">${idx + 1}</td>
                    <td><strong>${escapeHtml(fit.code)}</strong></td>
                    <td>
                        <strong>${escapeHtml(fit.name || fit.code)}</strong>
                        ${fit.tag ? `<br/><span style="color:#0369a1;font-size:8px;font-weight:600;">Tag: ${escapeHtml(fit.tag)}</span>` : ""}
                        ${fit.notes ? `<span style="color:#64748b;font-size:7.5px;"> &bull; ${escapeHtml(fit.notes)}</span>` : ""}
                    </td>
                    <td class="text-center">${escapeHtml(shapeStr)}</td>
                    <td>${escapeHtml(fit.dimensions || "-")}</td>
                    <td class="text-right">${fit.Q !== undefined ? numStr(fit.Q, 0) : "-"} ${flowUnit}</td>
                    <td class="text-right">${fit.velocity !== undefined ? numStr(fit.velocity, 2) : "-"} ${velUnit}</td>
                    <td class="text-center"><code>${escapeHtml(coeffType)}=${numStr(coeff, 3, String(coeff))}</code></td>
                    <td class="text-right"><strong>${lossDisplay}</strong></td>
                </tr>
            `;
        });

        // Summary Rows
        const summaryRowsHtml = `
            <tr class="total-row">
                <td colspan="8" class="text-right">SUBTOTAL FITTING PRESSURE LOSS (&Sigma;&Delta;P<sub>calc</sub>):</td>
                <td class="text-right">${numStr(cumDp, 1)} ${dpUnit}</td>
            </tr>
            <tr class="margin-row">
                <td colspan="8" class="text-right">DESIGN SAFETY MARGIN (+${marginPct.toFixed(1)}%):</td>
                <td class="text-right">+${numStr(marginDp, 1)} ${dpUnit}</td>
            </tr>
            <tr class="grand-total">
                <td colspan="8" class="text-right">TOTAL DESIGN SYSTEM PRESSURE LOSS (&Sigma;&Delta;P<sub>total</sub>):</td>
                <td class="text-right">${numStr(totalDesignDp, 1)} ${dpUnit}</td>
            </tr>
        `;

        // Section for step-by-step calculations
        let calcPagesHtml = "";
        if (includeCalcs && fittings.length > 0) {
            fittings.forEach((fit, idx) => {
                const qty = Math.max(1, parseInt(fit.qty || 1, 10));
                const singleLoss = parseFloat(fit.dp || 0) || 0;
                const totLoss = parseFloat(fit.total_dp) || (singleLoss * qty);
                const coeff = fit.f_or_Co !== undefined ? fit.f_or_Co : (fit.coeff || 0.25);
                const coeffType = fit.coeff_type || "C_o";
                const vel = fit.velocity !== undefined ? Number(fit.velocity) : 4.5;
                const pv = fit.pv !== undefined ? Number(fit.pv) : (0.5 * (isSi ? 1.204 : 0.075) * vel * vel);
                const flow = fit.Q !== undefined ? Number(fit.Q) : 500;

                // Step Breakdown
                let stepsHtml = "";
                if (fit.steps && Array.isArray(fit.steps) && fit.steps.length > 0) {
                    fit.steps.forEach(s => {
                        const stepLabel = s.step_label || `STEP ${s.step_num || 1}`;
                        const stepTitle = s.title || "";
                        const citation = s.citation ? `(${s.citation})` : "";
                        const formula = s.formula || s.governing_latex || "";
                        const result = s.result || "";

                        stepsHtml += `
                            <div class="pdf-calc-step-card">
                                <div class="pdf-step-title-row">
                                    <span class="pdf-step-label">${escapeHtml(stepLabel)}: ${escapeHtml(stepTitle)}</span>
                                    <span class="pdf-step-citation">${escapeHtml(citation)}</span>
                                </div>
                                ${formula ? `<div class="pdf-formula-row">${renderMath(formula, true)}</div>` : ""}
                                ${result ? `<div class="pdf-result-callout"><span>Result:</span> <strong>${escapeHtml(result)}</strong></div>` : ""}
                            </div>
                        `;
                    });
                } else {
                    // Standard ASHRAE 4-step engineering breakdown
                    const formula1 = `V = \\frac{Q}{A}`;
                    const formula2 = isSi ? `p_v = \\frac{1}{2}\\rho V^2 = 0.5 \\times 1.204 \\times (${numStr(vel, 2)})^2` : `p_v = \\left(\\frac{V}{4005}\\right)^2`;
                    const formula3 = `${coeffType} = ${numStr(coeff, 3)}`;
                    const formula4 = `\\Delta p_t = ${coeffType} \\cdot p_v = ${numStr(coeff, 3)} \\times ${numStr(pv, 1)} = ${numStr(singleLoss, 1)} \\text{ ${dpUnit}}`;

                    stepsHtml = `
                        <div class="pdf-calc-step-card">
                            <div class="pdf-step-title-row">
                                <span class="pdf-step-label">STEP 1: Cross-Sectional Mean Velocity</span>
                                <span class="pdf-step-citation">(ASHRAE Ch. 21 Eq. 1)</span>
                            </div>
                            <div class="pdf-formula-row">${renderMath(formula1, true)}</div>
                            <div class="pdf-result-callout"><span>Velocity (V):</span> <strong>${numStr(vel, 2)} ${velUnit}</strong></div>
                        </div>
                        <div class="pdf-calc-step-card">
                            <div class="pdf-step-title-row">
                                <span class="pdf-step-label">STEP 2: Velocity Pressure Formulation</span>
                                <span class="pdf-step-citation">(ASHRAE Ch. 21 Eq. 2)</span>
                            </div>
                            <div class="pdf-formula-row">${renderMath(formula2, true)}</div>
                            <div class="pdf-result-callout"><span>Velocity Pressure (Pv):</span> <strong>${numStr(pv, 1)} ${pvUnit}</strong></div>
                        </div>
                        <div class="pdf-calc-step-card">
                            <div class="pdf-step-title-row">
                                <span class="pdf-step-label">STEP 3: ASHRAE Loss Coefficient Lookup</span>
                                <span class="pdf-step-citation">(Official ASHRAE Fitting Database)</span>
                            </div>
                            <div class="pdf-formula-row">${renderMath(formula3, true)}</div>
                            <div class="pdf-result-callout"><span>Loss Coefficient (${coeffType}):</span> <strong>${numStr(coeff, 3)}</strong></div>
                        </div>
                        <div class="pdf-calc-step-card">
                            <div class="pdf-step-title-row">
                                <span class="pdf-step-label">STEP 4: Total Fitting Pressure Loss</span>
                                <span class="pdf-step-citation">(Total Pressure Method)</span>
                            </div>
                            <div class="pdf-formula-row">${renderMath(formula4, true)}</div>
                            <div class="pdf-result-callout">
                                <span>Unit Loss: <strong>${numStr(singleLoss, 1)} ${dpUnit}</strong></span>
                                <span>Total (${qty} pcs): <strong>${numStr(totLoss, 1)} ${dpUnit}</strong></span>
                            </div>
                        </div>
                    `;
                }

                calcPagesHtml += `
                    <div class="pdf-page-break">
                        <div class="pdf-item-banner">
                            <span>FITTING #${idx + 1}: ${escapeHtml(fit.code)} &mdash; ${escapeHtml(fit.name || fit.code)}</span>
                            <span>${fit.tag ? `Tag: ${escapeHtml(fit.tag)}` : `Qty: ${qty} pcs`}</span>
                        </div>

                        <div class="pdf-diagram-container">
                            <img src="/static/diagrams/${encodeURIComponent(fit.code)}.png" alt="${escapeHtml(fit.code)}" />
                        </div>

                        <div class="pdf-io-grid">
                            <div class="pdf-io-col">
                                <div class="pdf-io-header">Design Parameters &amp; Inputs</div>
                                <table class="pdf-io-table">
                                    <tr><td class="io-label">Fitting Code</td><td class="io-val">${escapeHtml(fit.code)}</td></tr>
                                    <tr><td class="io-label">Duct Geometry / Shape</td><td class="io-val">${escapeHtml((fit.shape || "rect").toUpperCase())}</td></tr>
                                    <tr><td class="io-label">Dimensions</td><td class="io-val">${escapeHtml(fit.dimensions || "-")}</td></tr>
                                    <tr><td class="io-label">Airflow Rate (Q)</td><td class="io-val">${numStr(flow, 1)} ${flowUnit}</td></tr>
                                    <tr><td class="io-label">Air Density (&rho;)</td><td class="io-val">${densVal}</td></tr>
                                </table>
                            </div>
                            <div class="pdf-io-col">
                                <div class="pdf-io-header">Calculation Outputs &amp; Pressure Loss</div>
                                <table class="pdf-io-table">
                                    <tr><td class="io-label">Mean Velocity (V)</td><td class="io-val">${numStr(vel, 2)} ${velUnit}</td></tr>
                                    <tr><td class="io-label">Velocity Pressure (Pv)</td><td class="io-val">${numStr(pv, 1)} ${pvUnit}</td></tr>
                                    <tr><td class="io-label">Loss Coefficient (${escapeHtml(coeffType)})</td><td class="io-val">${numStr(coeff, 3)}</td></tr>
                                    <tr><td class="io-label">Single Unit Loss (&Delta;p)</td><td class="io-val">${numStr(singleLoss, 1)} ${dpUnit}</td></tr>
                                    <tr style="background:#e0f2fe;"><td class="io-label" style="font-weight:700;color:#0369a1;">Total Loss (${qty} pcs)</td><td class="io-val" style="color:#0369a1;">${numStr(totLoss, 1)} ${dpUnit}</td></tr>
                                </table>
                            </div>
                        </div>

                        <div style="font-size:10px;font-weight:700;color:#0f172a;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.3px;">
                            Engineering Calculation Breakdown &amp; Formulation:
                        </div>
                        ${stepsHtml}
                    </div>
                `;
            });
        }

        return `
            ${REPORT_CSS}
            <div class="ductfit-pdf-root">
                <!-- Header -->
                <div class="pdf-header-bar">
                    <div>
                        <h1 class="pdf-brand-title">DUCTFIT PRO</h1>
                        <div class="pdf-brand-sub">HVAC Air Distribution &amp; Fitting Loss Analysis</div>
                    </div>
                    <div class="pdf-standard-badge">
                        <strong>ANSI / ASHRAE Fundamentals (Ch. 21)</strong>
                        Official Duct Fitting Database
                    </div>
                </div>

                <!-- Document Title -->
                <div class="pdf-doc-title">Project Duct Fitting Schedule &amp; Engineering Analysis</div>

                <!-- Project Specs Table -->
                <table class="pdf-spec-table">
                    <tr>
                        <td class="pdf-spec-label">Project Code:</td>
                        <td class="pdf-spec-val"><strong>${escapeHtml(project.code || "-")}</strong></td>
                        <td class="pdf-spec-label">Client:</td>
                        <td class="pdf-spec-val">${escapeHtml(project.client || "(Not specified)")}</td>
                    </tr>
                    <tr>
                        <td class="pdf-spec-label">Project Name:</td>
                        <td class="pdf-spec-val"><strong>${escapeHtml(project.name || "-")}</strong></td>
                        <td class="pdf-spec-label">Contractor:</td>
                        <td class="pdf-spec-val">${escapeHtml(project.contractor || "(Not specified)")}</td>
                    </tr>
                    <tr>
                        <td class="pdf-spec-label">System / Notes:</td>
                        <td class="pdf-spec-val">${escapeHtml(project.notes || "HVAC Air Distribution Network")}</td>
                        <td class="pdf-spec-label">Sub Contractor:</td>
                        <td class="pdf-spec-val">${escapeHtml(project.subcontractor || "(Not specified)")}</td>
                    </tr>
                    <tr>
                        <td class="pdf-spec-label">Standard &amp; Edition:</td>
                        <td class="pdf-spec-val">ANSI / ASHRAE Fundamentals (Ch. 21)</td>
                        <td class="pdf-spec-label">Date Generated:</td>
                        <td class="pdf-spec-val">${escapeHtml(nowStr)}</td>
                    </tr>
                </table>

                <!-- Engineering Basis -->
                <div class="pdf-basis-box">
                    <span><strong>Working Fluid:</strong> Standard Dry Air (&rho; = ${densVal})</span>
                    <span><strong>Loss Formulation:</strong> &Delta;p<sub>t</sub> = C<sub>o</sub> &bull; p<sub>v</sub> (Total Pressure Method)</span>
                </div>

                <!-- KPI Cards -->
                <div class="pdf-kpi-row">
                    <div class="pdf-kpi-card">
                        <div class="pdf-kpi-title">Total Fittings</div>
                        <div class="pdf-kpi-value">${fittings.length} (${totalQty} pcs)</div>
                    </div>
                    <div class="pdf-kpi-card">
                        <div class="pdf-kpi-title">Subtotal Loss (&Sigma;&Delta;P<sub>calc</sub>)</div>
                        <div class="pdf-kpi-value">${numStr(cumDp, 1)} ${dpUnit}</div>
                    </div>
                    <div class="pdf-kpi-card">
                        <div class="pdf-kpi-title">Design Margin (+${marginPct.toFixed(1)}%)</div>
                        <div class="pdf-kpi-value">+${numStr(marginDp, 1)} ${dpUnit}</div>
                    </div>
                    <div class="pdf-kpi-card primary">
                        <div class="pdf-kpi-title">Total Design ESP</div>
                        <div class="pdf-kpi-value" style="color:#0369a1;">${numStr(totalDesignDp, 1)} ${dpUnit}</div>
                    </div>
                </div>

                <!-- Schedule Table -->
                <table class="pdf-schedule-table">
                    <thead>
                        <tr>
                            <th class="text-center" style="width:25px;">#</th>
                            <th style="width:60px;">Code</th>
                            <th>Fitting Description / Tag</th>
                            <th class="text-center" style="width:45px;">Shape</th>
                            <th style="width:80px;">Dimensions</th>
                            <th class="text-right" style="width:65px;">Flow (Q)</th>
                            <th class="text-right" style="width:60px;">Vel (V)</th>
                            <th class="text-center" style="width:65px;">Loss Coeff</th>
                            <th class="text-right" style="width:75px;">Loss (&Delta;P)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                        ${summaryRowsHtml}
                    </tbody>
                </table>

                <!-- Signoff Bar -->
                <table style="width:100%;border-collapse:collapse;margin-top:15px;font-size:8.5px;color:#475569;">
                    <tr>
                        <td style="width:33%;border:1px solid #cbd5e1;padding:6px;background:#f8fafc;">
                            <strong>Prepared By:</strong> _______________________
                        </td>
                        <td style="width:33%;border:1px solid #cbd5e1;padding:6px;background:#f8fafc;">
                            <strong>Checked By:</strong> _______________________
                        </td>
                        <td style="width:34%;border:1px solid #cbd5e1;padding:6px;background:#f8fafc;">
                            <strong>Approved By:</strong> _______________________
                        </td>
                    </tr>
                </table>

                <!-- Step Calculations Pages -->
                ${calcPagesHtml}

                <!-- Footer Note -->
                <div class="pdf-footer-note">
                    <span>Generated by DuctFit Pro Web &bull; ASHRAE Fundamentals (Ch. 21)</span>
                    <span>Document: ${escapeHtml(project.code || "PRJ")}-FITTING-SCHEDULE</span>
                </div>
            </div>
        `;
    }

    /**
     * Build HTML for Duct Sizer Schedule Master Report
     */
    function buildSizerReportHtml(project, options = {}) {
        const u = project.unit_system || "SI";
        const isSi = (u === "SI");
        const dpUnit = isSi ? "Pa" : "in. wg";
        const flowUnit = isSi ? "L/s" : "cfm";
        const velUnit = isSi ? "m/s" : "fpm";
        const lenUnit = isSi ? "m" : "ft";
        const frUnit = isSi ? "Pa/m" : "in./100ft";
        const densVal = isSi ? "1.204 kg/m³" : "0.075 lbm/ft³";
        const nowStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

        const segments = project.duct_segments || [];
        const includeCalcs = Boolean(options.includeCalcs);
        const marginPct = Math.max(0, parseFloat(options.margin ?? project.margin_pct ?? project.design_margin ?? 10) || 0);

        let totalLength = 0;
        let cumDp = 0;
        segments.forEach(s => {
            const l = parseFloat(s.length || 0) || 0;
            totalLength += l;
            cumDp += (parseFloat(s.dp || 0) || 0);
        });

        const marginDp = cumDp * (marginPct / 100.0);
        const totalDesignDp = cumDp + marginDp;

        let tableRowsHtml = "";
        segments.forEach((seg, idx) => {
            const flow = seg.Q !== undefined ? seg.Q : (seg.flow || 0);
            const vel = seg.velocity || 0;
            const fr = seg.friction_rate || 0;
            const l = seg.length || 0;
            const dp = seg.dp || 0;
            const targetType = (seg.target_type || "friction") === "velocity" ? "Max Velocity" : "Equal Friction";
            const targetVal = seg.target_val ? `${numStr(seg.target_val, 2)} ${seg.target_type === "velocity" ? velUnit : frUnit}` : "-";

            tableRowsHtml += `
                <tr>
                    <td class="text-center">${idx + 1}</td>
                    <td><strong>${escapeHtml(seg.tag || `DS-${idx+1}`)}</strong></td>
                    <td class="text-right">${numStr(flow, 1)} ${flowUnit}</td>
                    <td class="text-center">${escapeHtml(targetType)}</td>
                    <td class="text-center">${escapeHtml(targetVal)}</td>
                    <td><strong>${escapeHtml(seg.dimensions || "-")}</strong></td>
                    <td class="text-center">${escapeHtml(seg.De || "-")}</td>
                    <td class="text-right">${numStr(vel, 2)} ${velUnit}</td>
                    <td class="text-right">${numStr(fr, 2)} ${frUnit}</td>
                    <td class="text-right">${numStr(l, 1)} ${lenUnit}</td>
                    <td class="text-right"><strong>${numStr(dp, 1)} ${dpUnit}</strong></td>
                </tr>
            `;
        });

        const summaryRowsHtml = `
            <tr class="total-row">
                <td colspan="9" class="text-right">TOTAL DUCT RUN LENGTH / SUBTOTAL FRICTION LOSS (&Sigma;&Delta;P<sub>calc</sub>):</td>
                <td class="text-right"><strong>${numStr(totalLength, 1)} ${lenUnit}</strong></td>
                <td class="text-right"><strong>${numStr(cumDp, 1)} ${dpUnit}</strong></td>
            </tr>
            <tr class="margin-row">
                <td colspan="10" class="text-right">DESIGN SAFETY MARGIN (+${marginPct.toFixed(1)}%):</td>
                <td class="text-right">+${numStr(marginDp, 1)} ${dpUnit}</td>
            </tr>
            <tr class="grand-total">
                <td colspan="10" class="text-right">TOTAL DESIGN SYSTEM PRESSURE LOSS (&Sigma;&Delta;P<sub>total</sub>):</td>
                <td class="text-right">${numStr(totalDesignDp, 1)} ${dpUnit}</td>
            </tr>
        `;

        // Step-by-step sizer calculation cards
        let calcPagesHtml = "";
        if (includeCalcs && segments.length > 0) {
            segments.forEach((seg, idx) => {
                const flow = seg.Q !== undefined ? seg.Q : (seg.flow || 0);
                const vel = seg.velocity || 0;
                const fr = seg.friction_rate || 0;
                const l = seg.length || 0;
                const dp = seg.dp || 0;

                const eqColebrook = `\\frac{1}{\\sqrt{f}} = -2 \\log_{10}\\left(\\frac{\\varepsilon / D_h}{3.7} + \\frac{2.51}{Re \\sqrt{f}}\\right)`;
                const eqDarcy = `\\Delta p_f = f \\cdot \\frac{L}{D_h} \\cdot p_v = \\left(\\frac{\\Delta p}{L}\\right) \\cdot L = ${numStr(fr, 2)} \\times ${numStr(l, 1)} = ${numStr(dp, 1)} \\text{ ${dpUnit}}`;

                calcPagesHtml += `
                    <div class="pdf-page-break">
                        <div class="pdf-item-banner">
                            <span>DUCT SECTION #${idx + 1}: ${escapeHtml(seg.tag || `DS-${idx+1}`)} &mdash; ${escapeHtml(seg.section_name || seg.dimensions || "Sized Section")}</span>
                            <span>Length: ${numStr(l, 1)} ${lenUnit}</span>
                        </div>

                        <div class="pdf-io-grid">
                            <div class="pdf-io-col">
                                <div class="pdf-io-header">Airflow &amp; Sizing Constraints</div>
                                <table class="pdf-io-table">
                                    <tr><td class="io-label">Airflow (Q)</td><td class="io-val">${numStr(flow, 1)} ${flowUnit}</td></tr>
                                    <tr><td class="io-label">Sizing Method</td><td class="io-val">${(seg.target_type || "friction") === "velocity" ? "Max Velocity" : "Equal Friction"}</td></tr>
                                    <tr><td class="io-label">Target Criteria</td><td class="io-val">${numStr(seg.target_val || 0.8, 2)}</td></tr>
                                    <tr><td class="io-label">Roughness (&epsilon;)</td><td class="io-val">${isSi ? "0.090 mm" : "0.0003 ft"}</td></tr>
                                    <tr><td class="io-label">Section Length (L)</td><td class="io-val">${numStr(l, 1)} ${lenUnit}</td></tr>
                                </table>
                            </div>
                            <div class="pdf-io-col">
                                <div class="pdf-io-header">Hydraulic Dimensions &amp; Pressure Loss</div>
                                <table class="pdf-io-table">
                                    <tr><td class="io-label">Selected Dimensions</td><td class="io-val"><strong>${escapeHtml(seg.dimensions || "-")}</strong></td></tr>
                                    <tr><td class="io-label">Equivalent Diameter (De)</td><td class="io-val">${escapeHtml(seg.De || "-")}</td></tr>
                                    <tr><td class="io-label">Air Velocity (V)</td><td class="io-val">${numStr(vel, 2)} ${velUnit}</td></tr>
                                    <tr><td class="io-label">Friction Rate (&Delta;Pf/L)</td><td class="io-val">${numStr(fr, 2)} ${frUnit}</td></tr>
                                    <tr style="background:#e0f2fe;"><td class="io-label" style="font-weight:700;color:#0369a1;">Section Friction Loss (&Delta;P)</td><td class="io-val" style="color:#0369a1;"><strong>${numStr(dp, 1)} ${dpUnit}</strong></td></tr>
                                </table>
                            </div>
                        </div>

                        <div class="pdf-calc-step-card">
                            <div class="pdf-step-title-row">
                                <span class="pdf-step-label">GOVERNING COLEBROOK-WHITE FRICTION FACTOR</span>
                                <span class="pdf-step-citation">(ASHRAE Ch. 21 Eq. 19)</span>
                            </div>
                            <div class="pdf-formula-row">${renderMath(eqColebrook, true)}</div>
                            <div class="pdf-result-callout"><span>Friction Rate (&Delta;p/L):</span> <strong>${numStr(fr, 2)} ${frUnit}</strong></div>
                        </div>

                        <div class="pdf-calc-step-card">
                            <div class="pdf-step-title-row">
                                <span class="pdf-step-label">DARCY-WEISBACH TOTAL FRICTION LOSS</span>
                                <span class="pdf-step-citation">(ASHRAE Ch. 21 Eq. 18)</span>
                            </div>
                            <div class="pdf-formula-row">${renderMath(eqDarcy, true)}</div>
                            <div class="pdf-result-callout"><span>Total Section Loss:</span> <strong>${numStr(dp, 1)} ${dpUnit}</strong></div>
                        </div>
                    </div>
                `;
            });
        }

        return `
            ${REPORT_CSS}
            <div class="ductfit-pdf-root">
                <div class="pdf-header-bar">
                    <div>
                        <h1 class="pdf-brand-title">DUCTFIT PRO</h1>
                        <div class="pdf-brand-sub">Auto Duct Sizer &amp; Hydraulic Schedule</div>
                    </div>
                    <div class="pdf-standard-badge">
                        <strong>ANSI / ASHRAE Fundamentals (Ch. 21)</strong>
                        Equal Friction &amp; Velocity Reduction Methods
                    </div>
                </div>

                <div class="pdf-doc-title">Project Auto Duct Sizing Schedule &amp; Engineering Analysis</div>

                <table class="pdf-spec-table">
                    <tr>
                        <td class="pdf-spec-label">Project Code:</td>
                        <td class="pdf-spec-val"><strong>${escapeHtml(project.code || "-")}</strong></td>
                        <td class="pdf-spec-label">Client:</td>
                        <td class="pdf-spec-val">${escapeHtml(project.client || "(Not specified)")}</td>
                    </tr>
                    <tr>
                        <td class="pdf-spec-label">Project Name:</td>
                        <td class="pdf-spec-val"><strong>${escapeHtml(project.name || "-")}</strong></td>
                        <td class="pdf-spec-label">Contractor:</td>
                        <td class="pdf-spec-val">${escapeHtml(project.contractor || "(Not specified)")}</td>
                    </tr>
                    <tr>
                        <td class="pdf-spec-label">System / Notes:</td>
                        <td class="pdf-spec-val">${escapeHtml(project.notes || "Auto Duct Sizing Schedule")}</td>
                        <td class="pdf-spec-label">Sub Contractor:</td>
                        <td class="pdf-spec-val">${escapeHtml(project.subcontractor || "(Not specified)")}</td>
                    </tr>
                    <tr>
                        <td class="pdf-spec-label">Standard &amp; Edition:</td>
                        <td class="pdf-spec-val">ANSI / ASHRAE Fundamentals (Ch. 21)</td>
                        <td class="pdf-spec-label">Date Generated:</td>
                        <td class="pdf-spec-val">${escapeHtml(nowStr)}</td>
                    </tr>
                </table>

                <div class="pdf-basis-box">
                    <span><strong>Working Fluid:</strong> Standard Dry Air (&rho; = ${densVal})</span>
                    <span><strong>Sizing Algorithms:</strong> Colebrook-White Friction Factor &amp; Darcy-Weisbach</span>
                </div>

                <div class="pdf-kpi-row">
                    <div class="pdf-kpi-card">
                        <div class="pdf-kpi-title">Duct Sections</div>
                        <div class="pdf-kpi-value">${segments.length} Runs</div>
                    </div>
                    <div class="pdf-kpi-card">
                        <div class="pdf-kpi-title">Total Duct Length</div>
                        <div class="pdf-kpi-value">${numStr(totalLength, 1)} ${lenUnit}</div>
                    </div>
                    <div class="pdf-kpi-card">
                        <div class="pdf-kpi-title">Subtotal Loss (&Sigma;&Delta;P<sub>calc</sub>)</div>
                        <div class="pdf-kpi-value">${numStr(cumDp, 1)} ${dpUnit}</div>
                    </div>
                    <div class="pdf-kpi-card primary">
                        <div class="pdf-kpi-title">Total Design ESP (+${marginPct.toFixed(1)}%)</div>
                        <div class="pdf-kpi-value" style="color:#0369a1;">${numStr(totalDesignDp, 1)} ${dpUnit}</div>
                    </div>
                </div>

                <table class="pdf-schedule-table">
                    <thead>
                        <tr>
                            <th class="text-center" style="width:25px;">#</th>
                            <th style="width:55px;">Tag</th>
                            <th class="text-right" style="width:60px;">Flow (Q)</th>
                            <th class="text-center" style="width:65px;">Method</th>
                            <th class="text-center" style="width:65px;">Target</th>
                            <th>Dimensions</th>
                            <th class="text-center" style="width:55px;">Equiv &Oslash;</th>
                            <th class="text-right" style="width:55px;">Vel (V)</th>
                            <th class="text-right" style="width:60px;">Friction Rate</th>
                            <th class="text-right" style="width:50px;">Length</th>
                            <th class="text-right" style="width:65px;">Loss (&Delta;P)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                        ${summaryRowsHtml}
                    </tbody>
                </table>

                ${calcPagesHtml}

                <div class="pdf-footer-note">
                    <span>Generated by DuctFit Pro Web &bull; ASHRAE Fundamentals (Ch. 21)</span>
                    <span>Document: ${escapeHtml(project.code || "PRJ")}-SIZER-SCHEDULE</span>
                </div>
            </div>
        `;
    }

    /**
     * Build HTML for Single Fitting Calculation Sheet Report
     */
    function buildCalculationReportHtml(payload) {
        const u = payload.unit_system || "SI";
        const isSi = (u === "SI");
        const dpUnit = isSi ? "Pa" : "in. wg";
        const flowUnit = isSi ? "L/s" : "cfm";
        const velUnit = isSi ? "m/s" : "fpm";
        const pvUnit = isSi ? "Pa" : "in. wg";
        const densVal = isSi ? "1.204 kg/m³" : "0.075 lbm/ft³";
        const nowStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

        const code = payload.code || "CR11-1";
        const name = payload.name || "ASHRAE Duct Fitting";
        const inputs = payload.inputs || {};
        const steps = payload.steps || [];

        // Build Inputs Rows
        let inputRowsHtml = "";
        for (const [k, v] of Object.entries(inputs)) {
            inputRowsHtml += `<tr><td class="io-label">${escapeHtml(k)}</td><td class="io-val">${escapeHtml(String(v))}</td></tr>`;
        }
        if (!inputRowsHtml) {
            inputRowsHtml = `<tr><td class="io-label">Air Density</td><td class="io-val">${densVal}</td></tr>`;
        }

        // Build Steps Cards
        let stepsHtml = "";
        if (steps && steps.length > 0) {
            steps.forEach(s => {
                const stepLabel = s.step_label || `STEP ${s.step_num || 1}`;
                const stepTitle = s.title || "";
                const citation = s.citation ? `(${s.citation})` : "";
                const formula = s.formula || s.governing_latex || "";
                const result = s.result || "";

                stepsHtml += `
                    <div class="pdf-calc-step-card">
                        <div class="pdf-step-title-row">
                            <span class="pdf-step-label">${escapeHtml(stepLabel)}: ${escapeHtml(stepTitle)}</span>
                            <span class="pdf-step-citation">${escapeHtml(citation)}</span>
                        </div>
                        ${formula ? `<div class="pdf-formula-row">${renderMath(formula, true)}</div>` : ""}
                        ${result ? `<div class="pdf-result-callout"><span>Result:</span> <strong>${escapeHtml(result)}</strong></div>` : ""}
                    </div>
                `;
            });
        } else {
            stepsHtml = `<div class="pdf-calc-step-card" style="color:#64748b;font-style:italic;">No detailed step calculations recorded for this item.</div>`;
        }

        return `
            ${REPORT_CSS}
            <div class="ductfit-pdf-root">
                <div class="pdf-header-bar">
                    <div>
                        <h1 class="pdf-brand-title">DUCTFIT PRO</h1>
                        <div class="pdf-brand-sub">Fitting Calculation Breakdown Sheet</div>
                    </div>
                    <div class="pdf-standard-badge">
                        <strong>ANSI / ASHRAE Fundamentals (Ch. 21)</strong>
                        Engineering Verification Sheet
                    </div>
                </div>

                <div class="pdf-doc-title">${escapeHtml(code)} &mdash; ${escapeHtml(name)}</div>

                <table class="pdf-spec-table">
                    <tr>
                        <td class="pdf-spec-label">Fitting Code:</td>
                        <td class="pdf-spec-val"><strong>${escapeHtml(code)}</strong></td>
                        <td class="pdf-spec-label">Unit System:</td>
                        <td class="pdf-spec-val">${escapeHtml(u)}</td>
                    </tr>
                    <tr>
                        <td class="pdf-spec-label">Fitting Name:</td>
                        <td class="pdf-spec-val">${escapeHtml(name)}</td>
                        <td class="pdf-spec-label">Date Generated:</td>
                        <td class="pdf-spec-val">${escapeHtml(nowStr)}</td>
                    </tr>
                </table>

                <div class="pdf-diagram-container">
                    <img src="/static/diagrams/${encodeURIComponent(code)}.png" alt="${escapeHtml(code)}" />
                </div>

                <div style="font-size:10px;font-weight:700;color:#0f172a;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.3px;">
                    Design Inputs &amp; Boundary Conditions:
                </div>
                <div style="margin-bottom:12px;border:1px solid #cbd5e1;border-radius:4px;overflow:hidden;">
                    <table class="pdf-io-table">
                        ${inputRowsHtml}
                    </table>
                </div>

                <div style="font-size:10px;font-weight:700;color:#0f172a;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.3px;">
                    Step-by-Step Engineering Calculation Breakdown:
                </div>
                ${stepsHtml}

                <div class="pdf-footer-note">
                    <span>Generated by DuctFit Pro Web &bull; ASHRAE Fundamentals (Ch. 21)</span>
                    <span>Document: CALC-${escapeHtml(code)}</span>
                </div>
            </div>
        `;
    }

    /**
     * Render an HTML report and trigger automatic client-side PDF download
     */
    async function renderAndDownloadPdf(html, filename) {
        if (typeof window === "undefined" || !document) return;

        // Check for html2pdf
        if (typeof window.html2pdf !== "function") {
            console.warn("html2pdf library not loaded yet, falling back to window.print()");
            printReportHtml(html);
            return;
        }

        const stage = document.createElement("div");
        stage.id = "ductfit-pdf-render-stage-" + Date.now();
        stage.style.position = "fixed";
        stage.style.left = "-9999px";
        stage.style.top = "0";
        stage.style.width = "794px";
        stage.style.background = "#ffffff";
        stage.style.color = "#0f172a";
        stage.style.zIndex = "-9999";
        stage.innerHTML = html;
        document.body.appendChild(stage);

        try {
            // Render any inline math in stage
            if (window.renderMathInElement) {
                window.renderMathInElement(stage, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false },
                        { left: '\\(', right: '\\)', display: false },
                        { left: '\\[', right: '\\]', display: true }
                    ],
                    throwOnError: false
                });
            }

            // Wait for all diagrams/images to load
            await waitForImages(stage);

            const opt = {
                margin: [8, 8, 10, 8], // mm (top, left, bottom, right)
                filename: filename || "DuctFit_Pro_Report.pdf",
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    letterRendering: true,
                    scrollY: 0
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            };

            await window.html2pdf().set(opt).from(stage).save();
        } catch (err) {
            console.error("html2pdf rendering failed:", err);
            // Fallback: Open print preview window
            printReportHtml(html);
        } finally {
            if (stage && stage.parentNode) {
                stage.parentNode.removeChild(stage);
            }
        }
    }

    /**
     * Fallback or print-native window popup
     */
    function printReportHtml(html) {
        const printWindow = window.open("", "_blank", "width=850,height=900");
        if (!printWindow) {
            alert("Popup blocked. Please allow popups to view/print the DuctFit Pro PDF report.");
            return;
        }
        printWindow.document.open();
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>DuctFit Pro Report - Print / PDF</title>
                <link rel="stylesheet" href="/static/katex/katex.min.css">
                <style>
                    body { margin: 0; padding: 20px; background: #fff; }
                    @media print {
                        body { padding: 0; }
                        .pdf-page-break { page-break-before: always; break-before: page; }
                    }
                </style>
            </head>
            <body>
                ${html}
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 500);
                    };
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    return {
        buildFittingReportHtml: buildFittingReportHtml,
        buildSizerReportHtml: buildSizerReportHtml,
        buildCalculationReportHtml: buildCalculationReportHtml,
        exportProjectFittingPdf: async function (project, options = {}) {
            const html = buildFittingReportHtml(project, options);
            const safeCode = (project.code || "Project").replace(/[^a-zA-Z0-9_-]/g, "_");
            const filename = `${safeCode}_Duct_Fitting_Report.pdf`;
            await renderAndDownloadPdf(html, filename);
        },
        exportProjectSizerPdf: async function (project, options = {}) {
            const html = buildSizerReportHtml(project, options);
            const safeCode = (project.code || "Project").replace(/[^a-zA-Z0-9_-]/g, "_");
            const filename = `${safeCode}_Duct_Sizing_Report.pdf`;
            await renderAndDownloadPdf(html, filename);
        },
        exportCalculationPdf: async function (payload) {
            const html = buildCalculationReportHtml(payload);
            const code = (payload.code || "Fitting").replace(/[^a-zA-Z0-9_-]/g, "_");
            const filename = `${code}_DuctFit_Pro_Calculation.pdf`;
            await renderAndDownloadPdf(html, filename);
        },
        printFittingReport: function (project, options = {}) {
            const html = buildFittingReportHtml(project, options);
            printReportHtml(html);
        },
        printSizerReport: function (project, options = {}) {
            const html = buildSizerReportHtml(project, options);
            printReportHtml(html);
        }
    };
}));
