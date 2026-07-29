document.addEventListener("DOMContentLoaded", function () {

    const categoryPills = document.querySelectorAll('.category-pill');
    const categoryInput = document.getElementById('category-input');
    const customWrap = document.getElementById('custom-category-wrap');

    categoryPills.forEach(function (pill) {
        pill.addEventListener('click', function () {
            categoryPills.forEach(function (p) { p.classList.remove('active'); });
            pill.classList.add('active');

            const value = pill.getAttribute('data-value');
            if (categoryInput) {
                categoryInput.value = value;
            }

            if (customWrap) {
                customWrap.style.display = (value === 'Other') ? 'block' : 'none';
            }
        });
    });

    const quickChips = document.querySelectorAll('.quick-chip');
    const questionInput = document.getElementById('ai-question-input');

    quickChips.forEach(function (chip) {
        chip.addEventListener('click', function () {
            const question = chip.getAttribute('data-question');
            if (questionInput) {
                questionInput.value = question;
                questionInput.focus();
            }
        });
    });
});