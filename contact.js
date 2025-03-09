const puppeteer = require('puppeteer');

async function fillContactForm(url, contactDetails) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });

  // Debugging: Check if the page is loaded correctly
  console.log('Page loaded');

  // Wait for the form elements to be available
  try {
    await page.waitForSelector('input[name="wpforms[fields][0]"]', { visible: true, timeout: 60000 });
    await page.waitForSelector('input[name="wpforms[fields][1]"]', { visible: true, timeout: 60000 });
    await page.waitForSelector('input[name="wpforms[fields][3]"]', { visible: true, timeout: 60000 });
    await page.waitForSelector('textarea[name="wpforms[fields][2]"]', { visible: true, timeout: 60000 });

    console.log('Form elements are available');
  } catch (error) {
    console.error('Error waiting for form elements:', error);
    await browser.close();
    return;
  }

  // Fill out the contact form
  await page.type('input[name="wpforms[fields][0]"]', contactDetails.name);
  await page.type('input[name="wpforms[fields][1]"]', contactDetails.email);
  await page.type('input[name="wpforms[fields][3]"]', contactDetails.contact);
  await page.type('textarea[name="wpforms[fields][2]"]', contactDetails.message);

  // Submit the form
  await page.click('button[type="submit"]', { delay: 100 });

  // Wait for a short duration to allow navigation
  await page.waitForTimeout(2000);

  // Log the current URL after submission for debugging
  const currentUrl = page.url();
  console.log('Current URL after submission:', currentUrl);

  // Wait for a response or a specific element to confirm submission
  try {
    await page.waitForSelector('.confirmation-message', { visible: true, timeout: 180000 });
    console.log('Contact form submitted successfully');
  } catch (error) {
    console.error('Error waiting for confirmation message:', error);
  }

  await browser.close();
}

// Example usage
const url = 'https://3mmaven.com/contact';
const contactDetails = {
  name: 'John Doe',
  email: 'john@example.com',
  contact: '1234567890',
  message: 'Hello, this is a test message',
};

fillContactForm(url, contactDetails).catch(console.error);
