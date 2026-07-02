// bir2316Templates.js

function safe(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value) {
  const num = Number(value || 0);
  if (!num) return "";
  return num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getFullName(staff = {}) {
  return (
    staff.full_name ||
    staff.staff_name ||
    [staff.last_name, staff.first_name, staff.middle_name]
      .filter(Boolean)
      .join(", ")
  );
}

function generateBir2316Template(data = {}) {
  const staff = data.staff || {};
  const company = data.company || {};

  const year = data.year || new Date().getFullYear();

  const monthlySalary = Number(
    data.monthlySalary ||
      staff.salary ||
      staff.basic_salary ||
      staff.monthly_salary ||
      0
  );

  const basicSalary = Number(data.basicSalary || monthlySalary * 12);
  const cola = Number(data.cola || data.ecola || 0);
  const benefits13th = Number(data.benefits13th || data.thirteenthMonth || 0);
  const deMinimis = Number(data.deMinimis || 0);
  const contributions = Number(
    data.contributions ||
      Number(data.sss || 0) +
        Number(data.philhealth || 0) +
        Number(data.pagibig || 0)
  );

  const nonTaxableOther = Number(data.nonTaxableOther || 0);

  const totalNonTaxable =
    benefits13th + deMinimis + contributions + nonTaxableOther;

  const grossCompensation = Number(
    data.grossCompensation || basicSalary + cola + totalNonTaxable
  );

  const taxableBasicSalary = Number(data.taxableBasicSalary || basicSalary);
  const representation = Number(data.representation || 0);
  const transportation = Number(data.transportation || 0);
  const fixedHousing = Number(data.fixedHousing || 0);
  const commission = Number(data.commission || 0);
  const profitSharing = Number(data.profitSharing || 0);
  const fees = Number(data.fees || 0);
  const taxable13th = Number(data.taxable13th || 0);
  const hazardPay = Number(data.hazardPay || 0);
  const overtimePay = Number(data.overtimePay || 0);
  const taxableOtherA = Number(data.taxableOtherA || 0);
  const taxableOtherB = Number(data.taxableOtherB || 0);

  const totalTaxable = Number(
    data.totalTaxable ||
      taxableBasicSalary +
        representation +
        transportation +
        cola +
        fixedHousing +
        commission +
        profitSharing +
        fees +
        taxable13th +
        hazardPay +
        overtimePay +
        taxableOtherA +
        taxableOtherB
  );

  const taxDue = Number(data.taxDue || data.withholdingTax || 0);
  const taxWithheldPresent = Number(data.taxWithheldPresent || taxDue);
  const taxWithheldPrevious = Number(data.taxWithheldPrevious || 0);
  const totalTaxWithheld = Number(
    data.totalTaxWithheld || taxWithheldPresent + taxWithheldPrevious
  );

  const employeeName = getFullName(staff);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>BIR Form 2316 - ${safe(employeeName)}</title>
    <style>
        @page {
            size: 8.5in 13in;
            margin: 6mm;
        }

        * {
            box-sizing: border-box;
            font-family: Arial, Helvetica, sans-serif;
        }

        body {
            margin: 0;
            padding: 0;
            background: #fff;
            color: #000;
            font-size: 10px;
            line-height: 1.05;
        }

        .form {
            width: 960px;
            max-width: 960px;
            margin: 0 auto;
            border: 3px solid #000;
            background: #fff;
        }

        .top {
            display: grid;
            grid-template-columns: 165px 1fr 255px;
            min-height: 78px;
            border-bottom: 3px solid #000;
        }

        .top-left {
            border-right: 3px solid #000;
            text-align: center;
            padding: 3px;
        }

        .top-center {
            text-align: center;
            padding: 2px 4px;
        }

        .top-right {
            border-left: 3px solid #000;
            padding: 4px;
            text-align: center;
        }

        .bir-no {
            font-size: 43px;
            font-weight: 900;
            line-height: 39px;
        }

        .main-title {
            font-size: 25px;
            font-weight: 900;
            line-height: 27px;
        }

        .small-title {
            font-size: 11px;
            font-weight: bold;
        }

        .barcode {
            height: 50px;
            border: 1px solid #000;
            background:
            repeating-linear-gradient(
                90deg,
                #000 0,
                #000 3px,
                #fff 3px,
                #fff 6px,
                #000 6px,
                #000 7px,
                #fff 7px,
                #fff 11px
            );
        }

        .instruction {
            height: 14px;
            border-bottom: 2px solid #000;
            padding-left: 4px;
            font-size: 10px;
            font-weight: bold;
        }

        .content {
            display: grid;
            grid-template-columns: 50% 50%;
        }

        .left {
            border-right: 3px solid #000;
        }

        .right {
            background: #d7d7d7;
        }

        .section-title {
            height: 16px;
            background: #cfcfcf;
            border-bottom: 2px solid #000;
            text-align: center;
            font-weight: 900;
            font-size: 11px;
            line-height: 15px;
        }

        .row {
            display: grid;
            min-height: 27px;
            border-bottom: 2px solid #000;
        }

        .cell {
            border-right: 2px solid #000;
            padding: 2px 5px;
            min-height: 27px;
        }

        .cell:last-child {
            border-right: none;
        }

        .label {
            font-weight: bold;
            font-size: 10px;
            line-height: 11px;
        }

        .boxline {
            height: 21px;
            border: 1px solid #777;
            background: #fff;
            margin-top: 2px;
            padding: 3px 5px;
            font-size: 10px;
            font-weight: bold;
            overflow: hidden;
            white-space: nowrap;
        }

        .checkbox {
            display: inline-block;
            width: 17px;
            height: 17px;
            border: 1px solid #000;
            background: #fff;
            text-align: center;
            font-weight: 900;
            line-height: 15px;
            margin: 0 4px;
            vertical-align: middle;
        }

        .amount-row {
            display: grid;
            grid-template-columns: 1fr 175px;
            min-height: 28px;
            }

            .amount-label {
            padding: 4px 6px 1px 6px;
            font-size: 10px;
            font-weight: bold;
            line-height: 11px;
            }

            .amount-box {
            padding: 2px 5px;
            }

            .amount-value {
            height: 23px;
            border: 1px solid #777;
            background: #fff;
            text-align: right;
            padding: 4px;
            font-size: 10px;
            font-weight: bold;
            }

            .summary-row {
            display: grid;
            grid-template-columns: 1fr 180px;
            min-height: 28px;
            border-bottom: 2px solid #000;
            }

            .summary-label {
            padding: 3px 6px;
            font-size: 10px;
            font-weight: bold;
            line-height: 11px;
            }

            .summary-box {
            padding: 2px 5px;
            }

            .summary-value {
            height: 23px;
            border: 1px solid #777;
            background: #fff;
            text-align: right;
            padding: 4px;
            font-size: 10px;
            font-weight: bold;
            }

        .footer {
            border-top: 3px solid #000;
            font-size: 9px;
        }

        .declaration {
            height: 35px;
            padding: 3px 8px;
            border-bottom: 2px solid #000;
            font-size: 8px;
            text-align: center;
            line-height: 9px;
        }



        .signature-area {
            display: grid;
            grid-template-columns: 52% 48%;
            min-height: 92px;
            border-bottom: 2px solid #000;
        }

        .signature-left {
            padding: 8px;
        }

        .signature-right {
            padding: 8px;
        }

        .signature-line {
            border-bottom: 2px solid #000;
            margin: 20px 35px 3px;
            height: 14px;
        }

        .signature-caption {
            text-align: center;
            font-size: 10px;
        }

        .footer-signatures {
            display: grid;
            grid-template-columns: 52% 48%;
            min-height: 130px;
            border-bottom: 2px solid #000;
            }

            .footer-left,
            .footer-right {
            padding: 8px;
            }

            .sig-line {
            border-bottom: 2px solid #000;
            height: 18px;
            margin: 8px 30px 2px;
            }

            .sig-caption {
            text-align: center;
            font-size: 9px;
            }

            .date-row {
            display: grid;
            grid-template-columns: 90px 170px;
            align-items: center;
            gap: 10px;
            margin: 14px 0;
            font-size: 10px;
            }

        .date-line {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            margin: 18px 0;
            font-size: 10px;
        }

        .date-box {
            height: 24px;
            border: 1px solid #000;
            background:
            repeating-linear-gradient(
            90deg,
            transparent 0,
            transparent 23px,
            #000 23px,
            #000 24px
            );
        }

        .ctc-box {
        height: 24px;
        border: 1px solid #000;
        }


        .ctc-row {
        display: grid;
        grid-template-columns: 105px 180px 60px 180px;
        align-items: end;
        gap: 8px;
        margin-top: 8px;
        font-size: 9px;
        }

        .sub-title {
        text-align: center;
        font-weight: 900;
        border-bottom: 2px solid #000;
        height: 16px;
        line-height: 15px;
        }

        .substituted {
        display: grid;
        grid-template-columns: 50% 50%;
        min-height: 95px;
        border-bottom: 2px solid #000;
        }

        .sub-box {
        padding: 5px 8px;
        font-size: 8px;
        line-height: 9px;
        border-right: 2px solid #000;
        }

        .sub-box:last-child {
            border-right: none;
        }

        .note {
        height: 16px;
        padding: 3px 5px;
        font-size: 10px;
        }

        @media print {
            html,
            body {
            width: 8.5in;
            height: 13in;
            }

            body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            }

            .form {
            width: 100%;
            max-width: none;
            margin: 0;
            page-break-inside: avoid;
            }
        }
    </style>
</head>

<body>
  <div class="form">
    <div class="top">
      <div class="top-left">
        <div style="text-align:left;font-size:7px;">For BIR<br/>Use Only</div>
        <div class="small-title">BIR Form No.</div>
        <div class="bir-no">2316</div>
        <div>September 2021 (ENCS)</div>
      </div>

      <div class="top-center">
        <div style="font-size:8px;font-weight:bold;">Republic of the Philippines</div>
        <div style="font-size:8px;font-weight:bold;">Department of Finance</div>
        <div style="font-size:8px;font-weight:bold;">Bureau of Internal Revenue</div>
        <div class="main-title">Certificate of Compensation<br/>Payment/Tax Withheld</div>
        <div class="small-title">For Compensation Payment With or Without Tax Withheld</div>
      </div>

      <div class="top-right">
        <div class="barcode"></div>
        <b>2316 9/21ENCS</b>
      </div>
    </div>

    <div class="instruction">
      Fill in all applicable spaces. Mark all appropriate boxes with an "X".
    </div>

    <div class="content">
      <div class="left">
        <div class="row" style="grid-template-columns: 50% 50%;">
          <div class="cell">
            <div class="label">1 For the Year<br/>(YYYY)</div>
            <div class="boxline">${safe(year)}</div>
          </div>
          <div class="cell">
            <div class="label">2 For the Period<br/>From (MM/DD) To (MM/DD)</div>
            <div class="boxline">${safe(data.periodFrom || "01/01")} - ${safe(data.periodTo || "12/31")}</div>
          </div>
        </div>

        <div class="section-title">Part I - Employee Information</div>

        <div class="row">
          <div class="cell">
            <div class="label">3 TIN</div>
            <div class="boxline">${safe(staff.tin || staff.employee_tin)}</div>
          </div>
        </div>

        <div class="row" style="grid-template-columns: 80% 20%;">
          <div class="cell">
            <div class="label">4 Employee's Name (Last Name, First Name, Middle Name)</div>
            <div class="boxline">${safe(employeeName)}</div>
          </div>
          <div class="cell">
            <div class="label">5 RDO Code</div>
            <div class="boxline">${safe(staff.rdo_code || data.rdoCode)}</div>
          </div>
        </div>

        <div class="row" style="grid-template-columns: 80% 20%;">
          <div class="cell">
            <div class="label">6 Registered Address</div>
            <div class="boxline">${safe(staff.address || staff.present_address || staff.permanent_address)}</div>
          </div>
          <div class="cell">
            <div class="label">6A ZIP Code</div>
            <div class="boxline">${safe(staff.zip_code)}</div>
          </div>
        </div>

        <div class="row" style="grid-template-columns: 80% 20%;">
          <div class="cell">
            <div class="label">6B Local Home Address</div>
            <div class="boxline">${safe(staff.local_address || staff.address)}</div>
          </div>
          <div class="cell">
            <div class="label">6C ZIP Code</div>
            <div class="boxline">${safe(staff.local_zip_code || staff.zip_code)}</div>
          </div>
        </div>

        <div class="row">
          <div class="cell">
            <div class="label">6D Foreign Address</div>
            <div class="boxline">${safe(staff.foreign_address)}</div>
          </div>
        </div>

        <div class="row" style="grid-template-columns: 45% 55%;">
          <div class="cell">
            <div class="label">7 Date of Birth (MM/DD/YYYY)</div>
            <div class="boxline">${safe(staff.birth_date || staff.date_of_birth)}</div>
          </div>
          <div class="cell">
            <div class="label">8 Contact Number</div>
            <div class="boxline">${safe(staff.contact_number || staff.mobile_number)}</div>
          </div>
        </div>

        <div class="row" style="grid-template-columns: 62% 38%;">
          <div class="cell">
            <div class="label">9 Statutory Minimum Wage rate per day</div>
            <div class="boxline">${money(data.minimumWagePerDay)}</div>
          </div>
          <div class="cell">
            <div class="boxline">${money(data.minimumWagePerDay)}</div>
          </div>
        </div>

        <div class="row" style="grid-template-columns: 62% 38%;">
          <div class="cell">
            <div class="label">10 Statutory Minimum Wage rate per month</div>
            <div class="boxline">${money(data.minimumWagePerMonth)}</div>
          </div>
          <div class="cell">
            <div class="boxline">${money(data.minimumWagePerMonth)}</div>
          </div>
        </div>

        <div class="row">
          <div class="cell">
            <span class="label">11</span>
            <span class="checkbox">${data.isMWE ? "X" : ""}</span>
            Minimum Wage Earner (MWE) whose compensation is exempt from withholding tax and not subject to income tax
          </div>
        </div>

        <div class="section-title">Part II - Employer Information (Present)</div>

        <div class="row">
          <div class="cell">
            <div class="label">12 TIN</div>
            <div class="boxline">${safe(company.tin)}</div>
          </div>
        </div>

        <div class="row">
          <div class="cell">
            <div class="label">13 Employer's Name</div>
            <div class="boxline">${safe(company.name || "AMBER CASH LENDING CORPORATION")}</div>
          </div>
        </div>

        <div class="row" style="grid-template-columns: 80% 20%;">
          <div class="cell">
            <div class="label">14 Registered Address</div>
            <div class="boxline">${safe(company.address)}</div>
          </div>
          <div class="cell">
            <div class="label">14A ZIP Code</div>
            <div class="boxline">${safe(company.zip_code)}</div>
          </div>
        </div>

        <div class="row">
          <div class="cell">
            <span class="label">15 Type of Employer</span>
            <span class="checkbox">X</span> Main Employer
            <span class="checkbox"></span> Secondary Employer
          </div>
        </div>

        <div class="section-title">Part III - Employer Information (Previous)</div>

        <div class="row">
          <div class="cell">
            <div class="label">16 TIN</div>
            <div class="boxline">${safe(data.previousEmployerTin)}</div>
          </div>
        </div>

        <div class="row">
          <div class="cell">
            <div class="label">17 Employer's Name</div>
            <div class="boxline">${safe(data.previousEmployerName)}</div>
          </div>
        </div>

        <div class="row" style="grid-template-columns: 80% 20%;">
          <div class="cell">
            <div class="label">18 Registered Address</div>
            <div class="boxline">${safe(data.previousEmployerAddress)}</div>
          </div>
          <div class="cell">
            <div class="label">18A ZIP Code</div>
            <div class="boxline">${safe(data.previousEmployerZip)}</div>
          </div>
        </div>

        <div class="section-title">Part IVA - Summary</div>

        ${summaryRow("19 Gross Compensation Income from Present Employer", grossCompensation)}
        ${summaryRow("20 Less: Total Non-Taxable/Exempt Compensation Income from Present Employer", totalNonTaxable)}
        ${summaryRow("21 Taxable Compensation Income from Present Employer", totalTaxable)}
        ${summaryRow("22 Add: Taxable Compensation Income from Previous Employer, if applicable", data.previousTaxableIncome)}
        ${summaryRow("23 Gross Taxable Compensation Income", totalTaxable + Number(data.previousTaxableIncome || 0))}
        ${summaryRow("24 Tax Due", taxDue)}
        ${summaryRow("25 Amount of Taxes Withheld - 25A Present Employer", taxWithheldPresent)}
        ${summaryRow("25B Previous Employer, if applicable", taxWithheldPrevious)}
        ${summaryRow("26 Total Amount of Taxes Withheld as adjusted", totalTaxWithheld)}
        ${summaryRow("27 5% Tax Credit (PERA Act of 2008)", data.peraTaxCredit)}
        ${summaryRow("28 Total Taxes Withheld", totalTaxWithheld + Number(data.peraTaxCredit || 0))}
      </div>

      <div class="right gray-area">
        <div class="section-title">Part IV-B Details of Compensation Income & Tax Withheld from Present Employer</div>

        <div class="amount-row">
          <div class="amount-label">A. NON-TAXABLE/EXEMPT COMPENSATION INCOME</div>
          <div class="amount-box"><b>Amount</b></div>
        </div>

        ${amountRow("29 Basic Salary (including the exempt P250,000 & below) or Statutory Minimum Wage of the MWE", data.nonTaxableBasicSalary)}
        ${amountRow("30 Holiday Pay (MWE)", data.holidayPay)}
        ${amountRow("31 Overtime Pay (MWE)", data.overtimePayMwe)}
        ${amountRow("32 Night Shift Differential (MWE)", data.nightShift)}
        ${amountRow("33 Hazard Pay (MWE)", data.hazardPayMwe)}
        ${amountRow("34 13th Month Pay and Other Benefits (maximum of P90,000)", benefits13th)}
        ${amountRow("35 De Minimis Benefits", deMinimis)}
        ${amountRow("36 SSS, GSIS, PHIC & PAG-IBIG Contributions and Union Dues", contributions)}
        ${amountRow("37 Salaries and Other Forms of Compensation", nonTaxableOther)}
        ${amountRow("38 Total Non-Taxable/Exempt Compensation Income", totalNonTaxable)}

        <div class="amount-row">
          <div class="amount-label">B. TAXABLE COMPENSATION INCOME REGULAR</div>
          <div class="amount-box"></div>
        </div>

        ${amountRow("39 Basic Salary", taxableBasicSalary)}
        ${amountRow("40 Representation", representation)}
        ${amountRow("41 Transportation", transportation)}
        ${amountRow("42 Cost of Living Allowance (COLA)", cola)}
        ${amountRow("43 Fixed Housing Allowance", fixedHousing)}
        ${amountRow("44 Others (specify)", data.otherSpecifyA)}
        ${amountRow("44A", taxableOtherA)}
        ${amountRow("44B", taxableOtherB)}

        <div class="amount-row">
          <div class="amount-label">SUPPLEMENTARY</div>
          <div class="amount-box"></div>
        </div>

        ${amountRow("45 Commission", commission)}
        ${amountRow("46 Profit Sharing", profitSharing)}
        ${amountRow("47 Fees Including Director's Fees", fees)}
        ${amountRow("48 Taxable 13th Month Benefits", taxable13th)}
        ${amountRow("49 Hazard Pay", hazardPay)}
        ${amountRow("50 Overtime Pay", overtimePay)}
        ${amountRow("51 Others (specify)", data.otherSpecifyB)}
        ${amountRow("51A", taxableOtherA)}
        ${amountRow("51B", taxableOtherB)}
        ${amountRow("52 Total Taxable Compensation Income", totalTaxable)}
      </div>
    </div>

    <div class="footer">
        <div class="declaration">
            I/We declare, under the penalties of perjury that this certificate has been made in good faith,
            verified by me/us, and to the best of my/our knowledge and belief, is true and correct,
            pursuant to the provisions of the National Internal Revenue Code, as amended, and the regulations
            issued under authority thereof.
        </div>

        <div class="footer-signatures">
            <div class="footer-left">
            <b>51</b>
            <div class="sig-line"></div>
            <div class="sig-caption">
                Present Employer/Authorized Agent Signature over Printed Name
            </div>

            <br />
            <b>CONFORME:</b>
            <br />

            <b>52</b>
            <div class="sig-line"></div>
            <div class="sig-caption">
                Employee Signature over Printed Name
            </div>

            <div class="ctc-row">
                <div>CTC/Valid ID No.<br />of Employee</div>
                <div class="ctc-box"></div>
                <div>Place of<br />Issue</div>
                <div class="ctc-box"></div>
            </div>
            </div>

            <div class="footer-right">
            <div class="date-row">
                <div>Date Signed</div>
                <div class="date-box"></div>
            </div>

            <div class="date-row">
                <div>Date Signed</div>
                <div class="date-box"></div>
            </div>

            <div class="date-row">
                <div>Date Issued</div>
                <div class="date-box"></div>
            </div>
            </div>
        </div>

        <div class="sub-title">To be accomplished under substituted filing</div>

        <div class="substituted">
            <div class="sub-box">
            I declare, under the penalties of perjury that the information herein stated are
            reported under BIR Form No. 1604-C which has been filed with the Bureau of Internal Revenue.

            <br /><br />

            <b>53</b>
            <div class="sig-line"></div>
            <div class="sig-caption">
                Present Employer/Authorized Agent Signature over Printed Name<br />
                (Head of Accounting/Human Resource or Authorized Representative)
            </div>
            </div>

            <div class="sub-box">
            I declare, under the penalties of perjury that I am qualified under substituted filing
            of Income Tax Return (BIR Form No. 1700), since I received purely compensation income
            from only one employer in the Philippines for the calendar year.

            <br /><br />

            <b>54</b>
            <div class="sig-line"></div>
            <div class="sig-caption">
                Employee Signature over Printed Name
            </div>
            </div>
        </div>

        <div class="note">
            *NOTE: The BIR Data Privacy is in the BIR website (www.bir.gov.ph)
        </div>
        </div>
  </div>
</body>
</html>
`;
}

function summaryRow(label, value) {
  return `
    <div class="summary-row">
      <div class="summary-label">${safe(label)}</div>
      <div class="summary-box">
        <div class="summary-value">${money(value)}</div>
      </div>
    </div>
  `;
}

function amountRow(label, value) {
  return `
    <div class="amount-row">
      <div class="amount-label">${safe(label)}</div>
      <div class="amount-box">
        <div class="amount-value">${money(value)}</div>
      </div>
    </div>
  `;
}

module.exports = {
  build2316Html: generateBir2316Template,
};