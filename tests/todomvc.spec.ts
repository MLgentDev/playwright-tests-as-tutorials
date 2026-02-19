import { test, expect } from '../lib/fixtures';

test('add and complete a todo', async ({ page, tutorialObj: tutorial }) => {
  await page.goto('https://demo.playwright.dev/todomvc/#/');

  // Introduce the app with a standalone speech
  await tutorial.speak('Welcome to the TodoMVC tutorial. Let\'s learn how to manage a todo list.');

  // Highlight the input field
  await tutorial.highlight('.new-todo', {
    title: 'New Todo Input',
    text: 'Type your todo item here and press Enter.',
    side: 'bottom',
    speech: 'This is the input field where you type new todo items.',
  });

  // Add a todo
  const input = page.getByPlaceholder('What needs to be done?');
  await input.fill('Buy groceries');
  await input.press('Enter');

  // Highlight the newly added todo
  await tutorial.highlight(page.getByTestId('todo-item'), {
    title: 'Your Todo',
    text: 'The todo item has been added to the list.',
    side: 'right',
    speech: 'Great! The todo item has been added to the list.',
  });

  // Add a second todo
  await input.fill('Walk the dog');
  await input.press('Enter');

  // Highlight the todo list
  await tutorial.highlight('.todo-list', {
    title: 'Todo List',
    text: 'All your todos appear here.',
    side: 'right',
  });

  // Complete the first todo
  const firstTodo = page.getByTestId('todo-item').nth(0);
  await tutorial.highlight(firstTodo.getByRole('checkbox'), {
    title: 'Complete',
    text: 'Click the checkbox to mark a todo as done.',
    side: 'right',
  });
  await firstTodo.getByRole('checkbox').check();

  // Verify it's completed
  await expect(firstTodo).toHaveClass(/completed/);

  // Highlight the filter buttons
  await tutorial.highlight('.filters', {
    title: 'Filters',
    text: 'Use these buttons to filter by All, Active, or Completed.',
    side: 'top',
    align: 'center',
    speech: 'These filter buttons let you switch between all, active, and completed todos.',
  });

  // Click "Active" filter
  await page.getByRole('link', { name: 'Active' }).click();

  // Only the incomplete todo should be visible
  await expect(page.getByTestId('todo-item')).toHaveCount(1);
  await expect(page.getByTestId('todo-item')).toHaveText('Walk the dog');

  await tutorial.highlight(page.getByTestId('todo-item'), {
    title: 'Active Todos',
    text: 'Only incomplete todos are shown in the Active view.',
    side: 'right',
  });

  // Click "Completed" filter
  await page.getByRole('link', { name: 'Completed' }).click();
  await expect(page.getByTestId('todo-item')).toHaveCount(1);
  await expect(page.getByTestId('todo-item')).toHaveText('Buy groceries');

  await tutorial.highlight(page.getByTestId('todo-item'), {
    title: 'Completed Todos',
    text: 'Completed todos are shown here with a strikethrough style.',
    side: 'right',
  });
});
