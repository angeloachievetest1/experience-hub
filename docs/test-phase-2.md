# Phase 2 test guide: Quality Analyst

The Quality Analyst section contains **50 sample records**. Each is marked with a
yellow **SAMPLE** tag, and its customer name starts with "Sample Customer". The
sample instructors ("Sample Instructor A–E") and analysts ("Sample Analyst 1–3")
are made up too. All of them are removed in Phase 4 with one command:

```bash
npm run db:sample:remove
```

---

## As yourself (Admin with the Quality Analyst section)

**Dashboard**
- [ ] The boxes show totals for all records and for each source.
- [ ] "Cases per month" shows coloured columns. **Quarter** groups them by quarter.
- [ ] Set the **Source** filter to only **Course**. July 2025 – January 2026 show as striped **"No data"** columns, not as 0.
- [ ] The validity, category and complaint-type bars change when you change the Source filter.
- [ ] The **date range** button (top right) changes every number and chart. The range you pick carries over to the other Quality Analyst pages.

**Survey insights**
- [ ] Surveys per month by type, total by type, rating distribution, and the two "Reason type by…" tables all show data.

**Case log**
- [ ] Filters work: Source (tick several), Analyst, Category, Validity, and the search box (try "Customer 10").
- [ ] Clicking a case opens its panel on the right.
- [ ] Change a field and click **Save changes**. The panel says "Changes saved" and the table updates.
- [ ] **Add case** → pick a type. A new blank case opens, ready to fill in.
- [ ] For a **Returned case**, the Courses field lets you tick several courses.
- [ ] **Delete case** asks "Yes, delete case" first. After confirming, the case disappears.

**Instructor view / Course view**
- [ ] Pick an instructor (or course) on the left. You see its cases, most common issues and validity split.
- [ ] Clicking a case opens the same panel.

**Follow-up**
- [ ] The four boxes filter the table: all open items, not reached, urgent action, no case link.
- [ ] "Reached vs not reached" shows the ring and the reach rate for email, SMS and call.

## As the Viewer test account (test@gmail.com)

- [ ] All five pages show the same data.
- [ ] There is **no Add case** button.
- [ ] Opening a case shows "Read only". There are no input boxes, and no Save or Delete buttons.

## On a phone-sized screen

- [ ] The menu is folded behind a **Menu** button at the top.
