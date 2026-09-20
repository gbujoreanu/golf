import { OpenGolfApiProvider } from './open-golf-api.js?v=2';

export class LatestRequestGate {
  constructor(){this.sequence=0}
  next(){this.sequence+=1;return this.sequence}
  isCurrent(request){return request===this.sequence}
}

export function mountCoursePicker({ root, onChoose, onManual, provider = new OpenGolfApiProvider(), debounceMs = 320 }) {
  if (!root) return null;
  const query = root.querySelector('[data-course-query]');
  const results = root.querySelector('[data-course-results]');
  const teePanel = root.querySelector('[data-course-tee-panel]');
  const teeSelect = root.querySelector('[data-course-tee]');
  const useButton = root.querySelector('[data-use-course]');
  const status = root.querySelector('[data-course-status]');
  const manual = root.querySelector('[data-manual-course]');
  let timer = null;
  const requestGate = new LatestRequestGate();
  let controller = null;
  let selectedCourse = null;
  let selectedOptions = null;

  const setStatus = (message, error = false) => {
    status.textContent = message;
    status.classList.toggle('error', error);
  };

  const clearSelection = () => {
    selectedCourse = null;
    selectedOptions = null;
    teePanel.hidden = true;
    teeSelect.replaceChildren();
    useButton.disabled = true;
  };

  const runSearch = async () => {
    const value = query.value.trim();
    const current = requestGate.next();
    controller?.abort();
    controller = new AbortController();
    clearSelection();
    results.replaceChildren();
    if (value.length < 2) {
      setStatus(value ? 'Type at least two characters.' : 'Search by course name.');
      return;
    }
    setStatus('Searching courses…');
    root.setAttribute('aria-busy', 'true');
    try {
      const courses = await provider.searchCourses(value, { signal: controller.signal });
      if (!requestGate.isCurrent(current)) return;
      renderResults(courses);
      setStatus(courses.length ? `${courses.length} course${courses.length === 1 ? '' : 's'} found.` : 'No matching courses. Try another name or use manual entry.');
    } catch (error) {
      if (error?.name !== 'AbortError' && requestGate.isCurrent(current)) setStatus(error?.message || 'Course search failed. Use manual entry instead.', true);
    } finally {
      if (requestGate.isCurrent(current)) root.removeAttribute('aria-busy');
    }
  };

  const renderResults = courses => {
    const list = document.createDocumentFragment();
    courses.forEach(course => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'course-result';
      button.dataset.courseId = course.id;
      const name = document.createElement('strong');
      name.textContent = course.name;
      const place = document.createElement('span');
      place.textContent = course.location;
      button.append(name, place);
      button.addEventListener('click', () => chooseCourse(course, button));
      list.append(button);
    });
    results.replaceChildren(list);
  };

  const chooseCourse = async (course, button) => {
    const current = requestGate.next();
    controller?.abort();
    controller = new AbortController();
    selectedCourse = course;
    selectedOptions = null;
    teePanel.hidden = true;
    [...results.querySelectorAll('.course-result')].forEach(item => item.classList.toggle('selected', item === button));
    setStatus(`Loading tees for ${course.name}…`);
    root.setAttribute('aria-busy', 'true');
    try {
      const options = await provider.getCourseOptions(course.id, { signal: controller.signal });
      if (!requestGate.isCurrent(current)) return;
      selectedCourse = options.course;
      selectedOptions = options;
      teeSelect.replaceChildren(new Option('Choose a tee', ''));
      options.tees.forEach((tee, index) => {
        const yardage = tee.yardage ? ` · ${tee.yardage.toLocaleString()} yd` : '';
        teeSelect.add(new Option(`${tee.label} · ${tee.rating} / ${tee.slope}${yardage}`, String(index)));
      });
      teePanel.hidden = false;
      useButton.disabled = true;
      setStatus('Choose the tee you plan to play.');
      teeSelect.focus({ preventScroll: true });
    } catch (error) {
      if (error?.name !== 'AbortError' && requestGate.isCurrent(current)) setStatus(error?.message || 'Tee data is unavailable. Use manual entry instead.', true);
    } finally {
      if (requestGate.isCurrent(current)) root.removeAttribute('aria-busy');
    }
  };

  query.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(runSearch, debounceMs);
  });
  query.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      clearTimeout(timer);
      runSearch();
    }
  });
  teeSelect.addEventListener('change', () => { useButton.disabled = teeSelect.value === ''; });
  useButton.addEventListener('click', async () => {
    const tee = selectedOptions?.tees?.[Number(teeSelect.value)];
    if (!selectedCourse || !tee) return;
    useButton.disabled = true;
    setStatus('Adding this tee to your round…');
    try {
      await onChoose({ course: selectedCourse, tee });
      setStatus(`${selectedCourse.name} · ${tee.label} selected.`);
    } catch (error) {
      setStatus('That tee could not be selected. Use manual entry or try again.', true);
      useButton.disabled = false;
      console.error(error);
    }
  });
  manual?.addEventListener('click', () => onManual?.());
  setStatus('Search by course name.');

  return {
    focus: () => query.focus({ preventScroll: true }),
    setDisabled(disabled) {
      root.hidden = Boolean(disabled);
      query.disabled = Boolean(disabled);
      teeSelect.disabled = Boolean(disabled);
      useButton.disabled = Boolean(disabled) || teeSelect.value === '';
    }
  };
}
