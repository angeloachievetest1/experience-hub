# Phase 3 test guide: Curriculum and Mentor

Both sections contain clearly marked **sample records**. They have a yellow
**SAMPLE** tag, customer names starting with "Sample Customer", and made-up
SMEs, requesters and ticket managers. The mentors are the real list. All samples
are removed in Phase 4 with `npm run db:sample:remove`.

---

## Curriculum (as yourself)

**Dashboard**
- [ ] Boxes: customer cases, average resolution time, top category, instructor requests.
- [ ] Cases per month (switch to **Quarter**), by category, by material type, average resolution time by category.
- [ ] **5-year trend** shows this year and the four before.
- [ ] The date range button changes the numbers (except the 5-year trend, which always shows all years).

**Case log**
- [ ] Filters: Category, Material type, Curriculum SME, and search.
- [ ] The **Link** column opens the case link in a new tab.
- [ ] Open a case, set **Date resolved**. **Resolution TAT (days)** fills in by itself, and you can still change it.
- [ ] **Add case**, **Save changes**, **Delete case** (asks first).

**Instructor requests**
- [ ] The status boxes (All / Complete / In Progress / …) filter the list.
- [ ] One row per request, as in the prototype. A blank requester shows as "No requester".
- [ ] **Add request**, **Save changes**, **Delete request** (asks first).

## Mentor (as yourself)

**Dashboard**
- [ ] Boxes: total, closed, in progress, valid complaints.
- [ ] Charts by year, by quarter, complaint type, sub type, mentor, and validity split.

**Case log**
- [ ] Filters: Mentor, Complaint type, Sub type, Status, Validity, and search.
- [ ] Open a case and change the **Date**. **Year** and **Quarter** update to match.
- [ ] **Email sent** is Yes / No. **Link** column works.
- [ ] **Add case** (starts as Status "New"), **Save changes**, **Delete case**.

## Everywhere
- [ ] Dropdown fields have **+ Add note**. Hovering over **Notes** shows the note.
- [ ] Save / Delete sit at the bottom of the panel, and only the panel scrolls.

## As the Viewer test account (test@gmail.com)
- [ ] Both sections show the same data, with **no Add buttons**.
- [ ] Opening any case or request shows **Read only**, with no Save or Delete buttons.
