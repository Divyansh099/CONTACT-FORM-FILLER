# Contact Form Filler

A responsive web application that allows you to fill contact forms on multiple websites with a single submission.

## Features

- Fill contact forms on multiple websites simultaneously
- Responsive and user-friendly interface
- Real-time status updates for each form submission
- Support for custom website URLs
- Confirmation messages for successful submissions

## Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/contact-form-filler.git
cd contact-form-filler
```

2. Install dependencies:
```bash
npm install
```

## Usage

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. Fill in your contact information:
   - Full Name
   - Email Address
   - Phone Number
   - Message

4. Select the websites where you want to submit the contact form:
   - Default websites are pre-configured
   - You can add custom website URLs

5. Click "Submit to All Selected Websites" button

6. View the status of each submission in real-time

## How It Works

The application uses Puppeteer, a headless browser automation library, to fill out contact forms on different websites. It attempts to identify common form patterns and field selectors to work with a variety of contact form implementations.

The process includes:
1. Identifying the contact form on the page
2. Locating and filling name, email, phone, and message fields
3. Submitting the form
4. Checking for success indicators
5. Reporting back the status to the user interface

## Customization

You can modify the default websites in the `index.html` file:

```html
<div class="website-option">
    <input type="checkbox" id="website1" name="websites" value="https://example.com/contact" checked>
    <label for="website1">Example Website</label>
</div>
```

## Dependencies

- Express: Web server framework
- Puppeteer: Headless browser automation
- Body-parser: Request body parsing middleware

## Development

For development with auto-restart:
```bash
npm run dev
```

## License

This project is licensed under the ISC License.

## Disclaimer

This tool is intended for legitimate use cases such as submitting your contact information to multiple service providers. Please use responsibly and respect website terms of service and rate limits.
