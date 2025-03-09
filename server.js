const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '.')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint to submit forms
app.post('/submit-forms', async (req, res) => {
  try {
    const { contactDetails, websites } = req.body;
    
    if (!contactDetails || !websites || !Array.isArray(websites) || websites.length === 0) {
      return res.status(400).json({ error: 'Invalid request data' });
    }
    
    // Process each website in parallel
    const results = await Promise.allSettled(
      websites.map(website => {
        // Create a copy of contact details to customize message for each website
        const websiteContactDetails = { ...contactDetails };
        
        // Customize message for each website
        const websiteName = new URL(website).hostname.replace('www.', '');
        websiteContactDetails.message = websiteContactDetails.message.replace(
          /Hello! .*?, how are you doing/,
          `Hello! ${websiteName}, how are you doing`
        );
        
        return fillContactForm(website, websiteContactDetails);
      })
    );
    
    // Format results
    const formattedResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return {
          website: websites[index],
          success: result.value.success,
          message: result.value.message
        };
      } else {
        return {
          website: websites[index],
          success: false,
          message: `Error: ${result.reason.message || 'Unknown error'}`
        };
      }
    });
    
    res.json(formattedResults);
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Function to fill contact form on a website
async function fillContactForm(url, contactDetails) {
  let browser;
  
  try {
    // Log the attempt
    console.log(`\n========================================`);
    console.log(`Starting form submission for: ${url}`);
    console.log(`Contact details: ${JSON.stringify(contactDetails)}`);
    console.log(`========================================\n`);
    
    browser = await puppeteer.launch({ 
      headless: false, // Changed to false to see what's happening
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages',
        '--disable-features=TranslateUI',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--window-size=1366,768'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set viewport for better compatibility
    await page.setViewport({ width: 1366, height: 768 });
    
    // Set user agent to look more like a real browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
    
    // Add error handlers
    page.on('pageerror', error => {
      console.log(`JavaScript error on ${url}: ${error.message}`);
    });
    
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`Console ${msg.type()} on ${url}: ${msg.text()}`);
      }
    });
    
    page.on('dialog', async dialog => {
      console.log(`Dialog on ${url}: ${dialog.message()}`);
      await dialog.dismiss();
    });
    
    // Disable specific scripts that might be causing issues
    await page.setRequestInterception(true);
    page.on('request', request => {
      try {
        if (request.resourceType() === 'script' && 
            (request.url().includes('multiVariateTestingCS.js') || 
             request.url().includes('analytics') ||
             request.url().includes('tracking') ||
             request.url().includes('extension'))) {
          request.abort();
        } else {
          request.continue();
        }
      } catch (error) {
        try {
          request.continue();
        } catch (e) {
          console.error(`Error handling request: ${e.message}`);
        }
      }
    });
    
    console.log(`Navigating to ${url}...`);
    
    // Navigate to the page
    try {
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 90000
      });
      console.log(`Page loaded: ${url}`);
    } catch (error) {
      console.log(`Navigation issue for ${url}: ${error.message}`);
      // Continue anyway
    }
    
    // Wait for page to stabilize
    await page.waitForTimeout(5000);
    
    // Take a screenshot of the initial page
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const domain = new URL(url).hostname;
      await page.screenshot({ 
        path: `initial-${domain}-${timestamp}.png`,
        fullPage: true
      });
      console.log(`Saved initial screenshot for ${url}`);
    } catch (error) {
      console.log(`Screenshot error: ${error.message}`);
    }
    
    console.log(`Looking for contact form on ${url}...`);
    
    // Try to identify the form
    const formSelectors = [
      'form[action*="contact"]',
      'form[id*="contact"]',
      'form[class*="contact"]',
      'form.wpcf7-form',
      'form.wpforms-form',
      'form.contact-form',
      'form#contact-form',
      'form.elementor-form',
      'form[data-form-type="contact"]',
      'div.contact-form form',
      'div.wpforms-container form',
      'div.elementor-widget-form form',
      'div[class*="contact"] form',
      'form' // Fallback to any form
    ];
    
    let formSelector = null;
    
    for (const selector of formSelectors) {
      try {
        const formExists = await page.$(selector);
        if (formExists) {
          formSelector = selector;
          console.log(`Found form with selector: ${selector}`);
          break;
        }
      } catch (error) {
        console.error(`Error checking form selector ${selector}: ${error.message}`);
      }
    }
    
    if (!formSelector) {
      console.log(`No form found with standard selectors. Trying to find inputs directly...`);
      
      // If no form is found, try to find inputs directly
      const nameInput = await findInputField(page, 'name');
      const emailInput = await findInputField(page, 'email');
      
      if (nameInput && emailInput) {
        console.log(`Found name and email inputs directly without a form`);
        
        // Fill the inputs directly
        await fillInputDirectly(page, nameInput, contactDetails.name);
        await fillInputDirectly(page, emailInput, contactDetails.email);
        
        // Try to find and fill phone
        const phoneInput = await findInputField(page, 'phone');
        if (phoneInput) {
          await fillInputDirectly(page, phoneInput, contactDetails.contact);
        }
        
        // Try to find and fill message
        const messageInput = await findInputField(page, 'message');
        if (messageInput) {
          await fillInputDirectly(page, messageInput, contactDetails.message);
        }
        
        // Try to find submit button
        const submitButton = await findSubmitButton(page);
        if (submitButton) {
          try {
            await page.evaluate(selector => {
              document.querySelector(selector).click();
            }, submitButton);
            console.log(`Clicked submit button found directly: ${submitButton}`);
            
            // Wait for submission
            await page.waitForTimeout(5000);
            
            // Take a screenshot after submission
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const domain = new URL(url).hostname;
            await page.screenshot({ 
              path: `after-direct-submit-${domain}-${timestamp}.png`,
              fullPage: true
            });
            
            await browser.close();
            return { success: true, message: 'Form submitted using direct input method' };
          } catch (error) {
            console.error(`Error submitting with direct method: ${error.message}`);
          }
        }
      }
      
      throw new Error('Could not find a contact form on the page');
    }
    
    // Common field patterns for different form types
    const fieldPatterns = [
      // Name field patterns
      { type: 'name', selectors: [
        'input[name*="name" i]', 
        'input[id*="name" i]',
        'input[placeholder*="name" i]',
        'input[name*="your-name" i]',
        'input[name="wpforms[fields][0]"]',
        'input[type="text"][id*="name" i]',
        'input.wpcf7-text[name*="name" i]',
        'input.form-control[id*="name" i]',
        'input[aria-label*="name" i]'
      ]},
      // Email field patterns
      { type: 'email', selectors: [
        'input[type="email"]',
        'input[name*="email" i]',
        'input[id*="email" i]',
        'input[placeholder*="email" i]',
        'input[name*="your-email" i]',
        'input[name="wpforms[fields][1]"]',
        'input.wpcf7-email',
        'input.form-control[type="email"]',
        'input[aria-label*="email" i]'
      ]},
      // Phone field patterns
      { type: 'phone', selectors: [
        'input[type="tel"]',
        'input[name*="phone" i]',
        'input[id*="phone" i]',
        'input[placeholder*="phone" i]',
        'input[name*="your-phone" i]',
        'input[name="wpforms[fields][3]"]',
        'input.wpcf7-tel',
        'input.form-control[type="tel"]',
        'input[aria-label*="phone" i]'
      ]},
      // Message field patterns
      { type: 'message', selectors: [
        'textarea',
        'textarea[name*="message" i]',
        'textarea[id*="message" i]',
        'textarea[placeholder*="message" i]',
        'textarea[name*="your-message" i]',
        'textarea[name="wpforms[fields][2]"]',
        'textarea.wpcf7-textarea',
        'textarea.form-control',
        'textarea[aria-label*="message" i]'
      ]},
      // Submit button patterns
      { type: 'submit', selectors: [
        'button[type="submit"]',
        'input[type="submit"]',
        'button[class*="submit" i]',
        'input[value*="send" i]',
        'input[value*="submit" i]',
        'button:contains("Send")',
        'button:contains("Submit")',
        'a[class*="submit" i]',
        'a.btn',
        'button.btn',
        'div[class*="submit" i]',
        'span[class*="submit" i]'
      ]}
    ];
    
    console.log(`Attempting to fill form fields for ${url}...`);
    
    // Try to fill each field type
    for (const fieldPattern of fieldPatterns) {
      if (fieldPattern.type === 'submit') continue; // Skip submit button for now
      
      let fieldFound = false;
      
      for (const selector of fieldPattern.selectors) {
        try {
          // First try to find within the form
          let field = await page.$(`${formSelector} ${selector}`);
          
          // If not found within form, try globally
          if (!field) {
            field = await page.$(selector);
          }
          
          if (field) {
            let value;
            
            switch (fieldPattern.type) {
              case 'name':
                value = contactDetails.name;
                break;
              case 'email':
                value = contactDetails.email;
                break;
              case 'phone':
                value = contactDetails.contact;
                break;
              case 'message':
                value = contactDetails.message;
                break;
            }
            
            // Try multiple methods to fill the field
            try {
              // First try to clear the field
              await page.evaluate(selector => {
                const element = document.querySelector(selector);
                if (element) element.value = '';
              }, selector);
              
              // Then try typing
              await page.type(selector, value, { delay: 50 });
              console.log(`Filled ${fieldPattern.type} field with selector: ${selector}`);
              fieldFound = true;
            } catch (typeError) {
              console.log(`Type method failed for ${fieldPattern.type}, trying evaluate: ${typeError.message}`);
              
              // If typing fails, try using evaluate
              await page.evaluate((selector, value) => {
                const element = document.querySelector(selector);
                if (element) {
                  element.value = value;
                  // Trigger input event to simulate user typing
                  const event = new Event('input', { bubbles: true });
                  element.dispatchEvent(event);
                  // Also trigger change event
                  const changeEvent = new Event('change', { bubbles: true });
                  element.dispatchEvent(changeEvent);
                }
              }, selector, value);
              
              console.log(`Filled ${fieldPattern.type} field using evaluate with selector: ${selector}`);
              fieldFound = true;
            }
            
            break;
          }
        } catch (error) {
          console.error(`Error filling ${fieldPattern.type} field:`, error);
        }
      }
      
      if (!fieldFound) {
        console.log(`Could not find ${fieldPattern.type} field on the form`);
        
        // Only throw for name and email as they're essential
        if (fieldPattern.type === 'name' || fieldPattern.type === 'email') {
          // Take a screenshot before giving up
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const domain = new URL(url).hostname;
          await page.screenshot({ 
            path: `missing-field-${fieldPattern.type}-${domain}-${timestamp}.png`,
            fullPage: true
          });
          
          throw new Error(`Could not find ${fieldPattern.type} field on the form`);
        }
      }
    }
    
    // Take a screenshot after filling the form
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const domain = new URL(url).hostname;
      await page.screenshot({ 
        path: `filled-form-${domain}-${timestamp}.png`,
        fullPage: true
      });
      console.log(`Saved filled form screenshot for ${url}`);
    } catch (error) {
      console.log(`Screenshot error: ${error.message}`);
    }
    
    console.log(`Attempting to submit form for ${url}...`);
    
    // Try to submit the form
    let submitButtonFound = false;
    
    for (const selector of fieldPatterns.find(p => p.type === 'submit').selectors) {
      try {
        // First try within the form
        let submitButton = await page.$(`${formSelector} ${selector}`);
        
        // If not found within form, try globally
        if (!submitButton) {
          submitButton = await page.$(selector);
        }
        
        if (submitButton) {
          // Try multiple submission methods
          try {
            // First try a normal click
            await page.click(selector);
            console.log(`Clicked submit button with selector: ${selector}`);
            submitButtonFound = true;
          } catch (clickError) {
            console.log(`Normal click failed, trying alternative methods: ${clickError.message}`);
            
            // Try using JavaScript click
            try {
              await page.evaluate(selector => {
                const button = document.querySelector(selector);
                if (button) button.click();
              }, selector);
              console.log(`Used JavaScript click on submit button with selector: ${selector}`);
              submitButtonFound = true;
            } catch (jsClickError) {
              console.log(`JavaScript click failed: ${jsClickError.message}`);
              
              // Try submitting the form directly
              try {
                await page.evaluate(formSelector => {
                  const form = document.querySelector(formSelector);
                  if (form) form.submit();
                }, formSelector);
                console.log(`Directly submitted form with selector: ${formSelector}`);
                submitButtonFound = true;
              } catch (formSubmitError) {
                console.log(`Form submit failed: ${formSubmitError.message}`);
                throw new Error('All submission methods failed');
              }
            }
          }
          break;
        }
      } catch (error) {
        console.error('Error with submit button:', error);
      }
    }
    
    if (!submitButtonFound) {
      // Take a screenshot before giving up
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const domain = new URL(url).hostname;
      await page.screenshot({ 
        path: `no-submit-button-${domain}-${timestamp}.png`,
        fullPage: true
      });
      
      throw new Error('Could not find submit button on the form');
    }
    
    // Wait for submission to complete
    console.log(`Waiting for submission to complete for ${url}...`);
    
    try {
      // Wait for navigation or timeout
      await Promise.race([
        page.waitForNavigation({ timeout: 10000 }).catch(() => {}),
        page.waitForTimeout(10000)
      ]);
    } catch (error) {
      console.log(`Navigation wait error: ${error.message}`);
    }
    
    // Take a screenshot after submission
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const domain = new URL(url).hostname;
      await page.screenshot({ 
        path: `after-submit-${domain}-${timestamp}.png`,
        fullPage: true
      });
      console.log(`Saved after-submit screenshot for ${url}`);
    } catch (error) {
      console.log(`Screenshot error: ${error.message}`);
    }
    
    // Check for success indicators
    const successIndicators = [
      '.wpcf7-mail-sent-ok',
      '.wpforms-confirmation-container',
      '.elementor-message-success',
      '.form-success',
      '.success-message',
      '.thank-you',
      'div[role="alert"]:not(.error)',
      'p:contains("Thank you")',
      'p:contains("thanks")',
      'div:contains("successfully")',
      '.alert-success',
      '.message-success',
      '.notification-success'
    ];
    
    let successFound = false;
    
    for (const selector of successIndicators) {
      try {
        const successElement = await page.$(selector);
        
        if (successElement) {
          successFound = true;
          console.log(`Found success indicator with selector: ${selector}`);
          break;
        }
      } catch (error) {
        console.error('Error checking success indicator:', error);
      }
    }
    
    // Close the browser
    try {
      await browser.close();
      console.log(`Browser closed for ${url}`);
    } catch (closeError) {
      console.error(`Error closing browser: ${closeError.message}`);
    }
    
    console.log(`\n========================================`);
    console.log(`Form submission completed for: ${url}`);
    console.log(`Success: ${successFound ? 'Yes' : 'Assumed (no indicator found)'}`);
    console.log(`========================================\n`);
    
    if (successFound) {
      return { success: true, message: 'Form submitted successfully!' };
    } else {
      // If we can't find a success indicator, we'll assume it was successful
      // since we were able to fill and submit the form
      return { success: true, message: 'Form submitted, but could not confirm success.' };
    }
  } catch (error) {
    console.error(`\n========================================`);
    console.error(`Error processing ${url}:`, error);
    console.error(`========================================\n`);
    
    // Take error screenshot
    if (browser) {
      try {
        const page = (await browser.pages())[0];
        if (page) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const domain = new URL(url).hostname;
          await page.screenshot({ 
            path: `error-${domain}-${timestamp}.png`,
            fullPage: true
          });
          console.log(`Saved error screenshot for ${url}`);
        }
      } catch (screenshotError) {
        console.log(`Error screenshot failed: ${screenshotError.message}`);
      }
    }
    
    // Make sure to close the browser
    if (browser) {
      try {
        await browser.close();
        console.log(`Browser closed after error for ${url}`);
      } catch (closeError) {
        console.error(`Error closing browser after error: ${closeError.message}`);
      }
    }
    
    return { success: false, message: error.message || 'Failed to submit form' };
  }
}

// Helper function to find input fields directly
async function findInputField(page, fieldType) {
  const selectors = {
    name: [
      'input[name*="name" i]', 
      'input[id*="name" i]',
      'input[placeholder*="name" i]',
      'input[type="text"][id*="name" i]',
      'input[aria-label*="name" i]'
    ],
    email: [
      'input[type="email"]',
      'input[name*="email" i]',
      'input[id*="email" i]',
      'input[placeholder*="email" i]',
      'input[aria-label*="email" i]'
    ],
    phone: [
      'input[type="tel"]',
      'input[name*="phone" i]',
      'input[id*="phone" i]',
      'input[placeholder*="phone" i]',
      'input[aria-label*="phone" i]'
    ],
    message: [
      'textarea',
      'textarea[name*="message" i]',
      'textarea[id*="message" i]',
      'textarea[placeholder*="message" i]',
      'textarea[aria-label*="message" i]'
    ]
  };
  
  for (const selector of selectors[fieldType]) {
    try {
      const exists = await page.$(selector);
      if (exists) {
        console.log(`Found ${fieldType} input with selector: ${selector}`);
        return selector;
      }
    } catch (error) {
      console.error(`Error finding ${fieldType} input:`, error);
    }
  }
  
  return null;
}

// Helper function to fill inputs directly
async function fillInputDirectly(page, selector, value) {
  try {
    // Clear the field first
    await page.evaluate(selector => {
      const element = document.querySelector(selector);
      if (element) element.value = '';
    }, selector);
    
    // Type the value
    await page.type(selector, value, { delay: 50 });
    console.log(`Filled input with selector ${selector} with value: ${value}`);
    return true;
  } catch (error) {
    console.error(`Error filling input directly:`, error);
    
    // Try alternative method
    try {
      await page.evaluate((selector, value) => {
        const element = document.querySelector(selector);
        if (element) {
          element.value = value;
          // Trigger events
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, selector, value);
      console.log(`Filled input using evaluate with selector ${selector}`);
      return true;
    } catch (evalError) {
      console.error(`Error filling input with evaluate:`, evalError);
      return false;
    }
  }
}

// Helper function to find submit button directly
async function findSubmitButton(page) {
  const selectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button[class*="submit" i]',
    'input[value*="send" i]',
    'input[value*="submit" i]',
    'a[class*="submit" i]',
    'a.btn',
    'button.btn',
    'div[class*="submit" i]',
    'span[class*="submit" i]'
  ];
  
  for (const selector of selectors) {
    try {
      const exists = await page.$(selector);
      if (exists) {
        console.log(`Found submit button with selector: ${selector}`);
        return selector;
      }
    } catch (error) {
      console.error(`Error finding submit button:`, error);
    }
  }
  
  return null;
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
}); 