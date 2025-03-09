document.addEventListener('DOMContentLoaded', () => {
    // Global error handler
    window.addEventListener('error', function(event) {
        console.error('Global error caught:', event.error);
        // Prevent the error from breaking our application
        event.preventDefault();
    });
    
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', function(event) {
        console.error('Unhandled promise rejection:', event.reason);
        // Prevent the rejection from breaking our application
        event.preventDefault();
    });
    
    const contactForm = document.getElementById('contact-form');
    const statusContainer = document.getElementById('status-container');
    const statusList = document.getElementById('status-list');
    const mainLoader = document.getElementById('main-loader');
    const backButton = document.getElementById('back-button');
    const addWebsiteButton = document.getElementById('add-website');
    const customUrlInput = document.getElementById('custom-url');
    const websiteOptions = document.querySelector('.website-options');
    
    // Set default contact details
    document.getElementById('name').value = 'Jerry';
    document.getElementById('email').value = 'jerrry@gmail.cam';
    document.getElementById('phone').value = '1234567890';
    document.getElementById('message').value = 'Hello! 3M Maven, how are you doing. This is a test message';
    
    // Counter for custom website IDs
    let customWebsiteCounter = 4; // Start after the 3 default websites
    
    // Function to update message with website name
    const updateMessageWithWebsiteName = () => {
        try {
            const selectedWebsites = document.querySelectorAll('input[name="websites"]:checked');
            if (selectedWebsites.length === 1) {
                const websiteUrl = selectedWebsites[0].value;
                const websiteName = selectedWebsites[0].nextElementSibling.textContent.trim();
                document.getElementById('message').value = `Hello! ${websiteName}, how are you doing. This is a test message`;
            } else {
                document.getElementById('message').value = 'Hello! This is a test message from Jerry. How are you doing?';
            }
        } catch (error) {
            console.error('Error updating message:', error);
            // Fallback to default message
            document.getElementById('message').value = 'Hello! This is a test message from Jerry. How are you doing?';
        }
    };
    
    // Add event listeners to checkboxes to update message
    document.querySelectorAll('input[name="websites"]').forEach(checkbox => {
        checkbox.addEventListener('change', updateMessageWithWebsiteName);
    });
    
    // Add custom website
    addWebsiteButton.addEventListener('click', () => {
        const customUrl = customUrlInput.value.trim();
        
        if (!customUrl) {
            alert('Please enter a valid URL');
            return;
        }
        
        if (!customUrl.startsWith('http://') && !customUrl.startsWith('https://')) {
            alert('URL must start with http:// or https://');
            return;
        }
        
        // Create new website option
        const websiteOption = document.createElement('div');
        websiteOption.className = 'website-option';
        
        const websiteName = new URL(customUrl).hostname.replace('www.', '');
        
        websiteOption.innerHTML = `
            <input type="checkbox" id="website${customWebsiteCounter}" name="websites" value="${customUrl}" checked>
            <label for="website${customWebsiteCounter}">${websiteName}</label>
        `;
        
        websiteOptions.appendChild(websiteOption);
        
        // Add event listener to the new checkbox
        const newCheckbox = websiteOption.querySelector('input[type="checkbox"]');
        newCheckbox.addEventListener('change', updateMessageWithWebsiteName);
        
        // Update message with the new website name
        updateMessageWithWebsiteName();
        
        customUrlInput.value = '';
        customWebsiteCounter++;
    });
    
    // Handle form submission
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(contactForm);
        const name = formData.get('name');
        const email = formData.get('email');
        const phone = formData.get('phone');
        const message = formData.get('message');
        
        // Get selected websites
        const selectedWebsites = [];
        document.querySelectorAll('input[name="websites"]:checked').forEach(checkbox => {
            selectedWebsites.push(checkbox.value);
        });
        
        if (selectedWebsites.length === 0) {
            alert('Please select at least one website');
            return;
        }
        
        // Show status container and hide form
        contactForm.style.display = 'none';
        statusContainer.classList.remove('hidden');
        
        // Create status items for each website
        statusList.innerHTML = '';
        selectedWebsites.forEach(website => {
            const websiteName = new URL(website).hostname.replace('www.', '');
            
            const statusItem = document.createElement('div');
            statusItem.className = 'status-item';
            statusItem.dataset.website = website;
            
            statusItem.innerHTML = `
                <div class="status-icon pending">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
                <div class="status-text">
                    <h3>${websiteName}</h3>
                    <p>Submitting form...</p>
                </div>
            `;
            
            statusList.appendChild(statusItem);
        });
        
        // Submit forms to server
        try {
            const response = await fetch('/submit-forms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contactDetails: {
                        name,
                        email,
                        contact: phone,
                        message
                    },
                    websites: selectedWebsites
                })
            });
            
            if (!response.ok) {
                throw new Error('Server error');
            }
            
            const results = await response.json();
            
            // Update status for each website
            results.forEach(result => {
                const statusItem = document.querySelector(`.status-item[data-website="${result.website}"]`);
                
                if (statusItem) {
                    const statusIcon = statusItem.querySelector('.status-icon');
                    const statusText = statusItem.querySelector('.status-text p');
                    
                    statusIcon.className = `status-icon ${result.success ? 'success' : 'error'}`;
                    statusIcon.innerHTML = result.success 
                        ? '<i class="fas fa-check-circle"></i>' 
                        : '<i class="fas fa-times-circle"></i>';
                    
                    statusText.textContent = result.message;
                }
            });
        } catch (error) {
            console.error('Error submitting forms:', error);
            
            // Update all pending items to error
            document.querySelectorAll('.status-icon.pending').forEach(icon => {
                icon.className = 'status-icon error';
                icon.innerHTML = '<i class="fas fa-times-circle"></i>';
                
                const statusText = icon.closest('.status-item').querySelector('.status-text p');
                statusText.textContent = 'Failed to submit form. Server error.';
            });
        }
        
        // Hide loader and show back button
        mainLoader.classList.add('hidden');
        backButton.classList.remove('hidden');
    });
    
    // Back button handler
    backButton.addEventListener('click', () => {
        statusContainer.classList.add('hidden');
        contactForm.style.display = 'block';
    });
    
    // For demo purposes - simulate form submission without a server
    // Remove this in production and use the actual server implementation
    window.simulateFormSubmission = async function() {
        // Simulate server delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get all status items
        const statusItems = document.querySelectorAll('.status-item');
        
        // Simulate random success/failure
        statusItems.forEach(item => {
            const success = Math.random() > 0.3; // 70% success rate
            
            const statusIcon = item.querySelector('.status-icon');
            const statusText = item.querySelector('.status-text p');
            
            statusIcon.className = `status-icon ${success ? 'success' : 'error'}`;
            statusIcon.innerHTML = success 
                ? '<i class="fas fa-check-circle"></i>' 
                : '<i class="fas fa-times-circle"></i>';
            
            statusText.textContent = success 
                ? 'Form submitted successfully!' 
                : 'Failed to submit form. Please try again.';
        });
        
        // Hide loader and show back button
        mainLoader.classList.add('hidden');
        backButton.classList.remove('hidden');
        
        return Array.from(statusItems).map(item => {
            const website = item.dataset.website;
            const success = item.querySelector('.status-icon').classList.contains('success');
            const message = item.querySelector('.status-text p').textContent;
            
            return { website, success, message };
        });
    };
    
    // Override fetch for demo purposes
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
        if (url === '/submit-forms' && options.method === 'POST') {
            return new Promise(async (resolve) => {
                const body = JSON.parse(options.body);
                const websites = body.websites;
                
                // Simulate server delay
                await new Promise(r => setTimeout(r, 2000));
                
                const results = websites.map(website => {
                    const success = Math.random() > 0.3; // 70% success rate
                    
                    return {
                        website,
                        success,
                        message: success 
                            ? 'Form submitted successfully!' 
                            : 'Failed to submit form. Please try again.'
                    };
                });
                
                resolve({
                    ok: true,
                    json: () => Promise.resolve(results)
                });
            });
        }
        
        return originalFetch(url, options);
    };
}); 