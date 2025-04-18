// Function to get CSRF token from meta tag
function getCsrfToken() {
    return document.querySelector('meta[name="csrf-token"]').content;
}

// Updated queue drag and drop function with CSRF protection
function initQueueDragDrop() {
    const queueList = document.getElementById('queue-list');
    if (!queueList) return; // Exit if no queue list found
    
    let draggedItem = null;
    let dragStartIndex = 0;
    
    // Add event listeners to queue items
    const queueItems = queueList.querySelectorAll('.queue-item');
    queueItems.forEach((item, index) => {
        // Drag start event
        item.addEventListener('dragstart', function(e) {
            draggedItem = item;
            dragStartIndex = index;
            
            // Add a class to show it's being dragged
            setTimeout(() => {
                item.classList.add('dragging');
            }, 0);
            
            // Set data for drag operation
            e.dataTransfer.setData('text/plain', item.dataset.id);
            e.dataTransfer.effectAllowed = 'move';
        });
        
        // Drag end event
        item.addEventListener('dragend', function() {
            item.classList.remove('dragging');
            draggedItem = null;
        });
        
        // Drag over event
        item.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            // Add a class to show it's a drop target
            this.classList.add('dragover');
        });
        
        // Drag leave event
        item.addEventListener('dragleave', function() {
            this.classList.remove('dragover');
        });
        
        // Drop event
        item.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('dragover');
            
            // Get the drop index
            const dropIndex = Array.from(queueItems).indexOf(this);
            
            // Only do something if dropping on a different item
            if (draggedItem && dragStartIndex !== dropIndex) {
                // Move the item in the DOM
                if (dropIndex < dragStartIndex) {
                    queueList.insertBefore(draggedItem, this);
                } else {
                    queueList.insertBefore(draggedItem, this.nextSibling);
                }
                
                // Send the reorder info to the server
                updateQueueOrder(dragStartIndex, dropIndex);
            }
        });
    });
    
    // Function to send the reordered queue to the server
    function updateQueueOrder(oldIndex, newIndex) {
        // Get the guild ID and channel ID from the page
        const container = document.querySelector('.container-fluid');
        const guildId = container ? container.dataset.guildId : null;
        const channelId = container ? container.dataset.channelId : null;
        
        if (!guildId || !channelId) return;
        
        // Create a form to submit the new order
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = `/server/${guildId}/queue/reorder`;
        form.style.display = 'none';
        
        // Add CSRF token
        const csrfInput = document.createElement('input');
        csrfInput.type = 'hidden';
        csrfInput.name = 'csrf_token';
        csrfInput.value = getCsrfToken();
        form.appendChild(csrfInput);
        
        // Add the necessary data
        const channelInput = document.createElement('input');
        channelInput.name = 'channel_id';
        channelInput.value = channelId;
        form.appendChild(channelInput);
        
        const oldIndexInput = document.createElement('input');
        oldIndexInput.name = 'old_index';
        oldIndexInput.value = oldIndex;
        form.appendChild(oldIndexInput);
        
        const newIndexInput = document.createElement('input');
        newIndexInput.name = 'new_index';
        newIndexInput.value = newIndex;
        form.appendChild(newIndexInput);
        
        // Submit the form
        document.body.appendChild(form);
        form.submit();
    }
}

// Updated queue manager with CSRF protection for AJAX
function initQueueManager() {
    const guildId = document.querySelector('[data-guild-id]')?.dataset.guildId;
    const channelId = document.querySelector('[data-channel-id]')?.dataset.channelId;
    
    if (!guildId || !channelId) return;

    // Function to refresh queue data
    function refreshQueueData() {
        fetch(`/server/${guildId}/queue/ajax?channel_id=${channelId}`, {
            headers: {
                'X-CSRF-Token': getCsrfToken()  // Add CSRF token to header
            }
        })
            .then(response => response.json())
            .then(data => {
                updateQueueDisplay(data);
            })
            .catch(error => console.error('Error refreshing queue:', error));
    }
    
    // Update queue display without page refresh
    function updateQueueDisplay(data) {
        const currentTrackDiv = document.getElementById('current-track');
        const queueListDiv = document.getElementById('queue-list');
        const queueEmptyDiv = document.getElementById('queue-empty');
        const botControlsDiv = document.getElementById('bot-controls');
        
        // Update connection status indicators
        document.querySelectorAll('.bot-status-indicator').forEach(indicator => {
            indicator.classList.add('d-none');
        });
        
        // Update status display
        if (data.is_connected) {
            const statusElement = document.getElementById(
                data.is_playing ? 'status-playing' : 
                (data.is_paused ? 'status-paused' : 'status-connected')
            );
            if (statusElement) {
                statusElement.classList.remove('d-none');
            }
        } else {
            const disconnectedStatus = document.getElementById('status-disconnected');
            if (disconnectedStatus) {
                disconnectedStatus.classList.remove('d-none');
            }
        }
        
        // Update current track
        if (data.current_track && currentTrackDiv) {
            currentTrackDiv.innerHTML = `
                <div class="d-flex align-items-center">
                    <div class="me-2">
                        <i class="fas fa-play-circle text-success"></i>
                    </div>
                    <div>
                        <h6 class="mb-0">Now Playing:</h6>
                        <p class="mb-0">${data.current_track.title}</p>
                    </div>
                </div>
            `;
            currentTrackDiv.classList.remove('d-none');
            
            // Update bot controls visibility
            if (botControlsDiv) {
                botControlsDiv.classList.remove('d-none');
                
                // Update play/pause button state
                const pauseButton = document.getElementById('pause-button');
                const resumeButton = document.getElementById('resume-button');
                
                if (pauseButton && resumeButton) {
                    if (data.is_paused) {
                        pauseButton.classList.add('d-none');
                        resumeButton.classList.remove('d-none');
                    } else {
                        pauseButton.classList.remove('d-none');
                        resumeButton.classList.add('d-none');
                    }
                }
            }
        } else if (currentTrackDiv) {
            currentTrackDiv.classList.add('d-none');
            
            // Hide controls if not connected
            if (botControlsDiv && !data.is_connected) {
                botControlsDiv.classList.add('d-none');
            }
        }
        
        // Update queue list
        if (queueListDiv && data.queue) {
            if (data.queue.length > 0) {
                let queueHtml = '';
                data.queue.forEach((item, index) => {
                    queueHtml += `
                        <div class="list-group-item bg-dark text-light border-secondary queue-item" data-id="${item.id}" draggable="true">
                            <div class="d-flex w-100 justify-content-between align-items-start">
                                <div>
                                    <div class="drag-handle me-2 d-inline-block">
                                        <i class="fas fa-grip-vertical text-muted"></i>
                                    </div>
                                    <h6 class="mb-1 d-inline-block">${item.title}</h6>
                                </div>
                                <span class="badge bg-secondary">${index + 1}</span>
                            </div>
                        </div>
                    `;
                });
                
                queueListDiv.innerHTML = queueHtml;
                queueListDiv.classList.remove('d-none');
                
                if (queueEmptyDiv) {
                    queueEmptyDiv.classList.add('d-none');
                }
                
                // Re-initialize drag and drop after updating the queue
                initQueueDragDrop();
            } else {
                queueListDiv.innerHTML = '';
                if (queueEmptyDiv) {
                    queueEmptyDiv.classList.remove('d-none');
                }
            }
        }

        // Update last refreshed timestamp
        const lastRefreshed = document.getElementById('last-refreshed');
        if (lastRefreshed) {
            const now = new Date();
            lastRefreshed.textContent = `Last updated: ${now.toLocaleTimeString()}`;
        }
    }

    // Add event listeners for control buttons
    document.querySelectorAll('.playback-control, .join-button, #leave-button').forEach(button => {
        button.addEventListener('click', function() {
            // After any control action, refresh the state once
            setTimeout(refreshQueueData, 500);
        });
    });

    // Initial refresh on page load
    refreshQueueData();
}

// Helper function to create and submit a form with CSRF token
function submitFormWithCsrf(action, data = {}) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = action;
    form.style.display = 'none';
    
    // Add CSRF token
    const csrfInput = document.createElement('input');
    csrfInput.type = 'hidden';
    csrfInput.name = 'csrf_token';
    csrfInput.value = getCsrfToken();
    form.appendChild(csrfInput);
    
    // Add all data fields
    Object.entries(data).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value;
        form.appendChild(input);
    });
    
    // Add to document and submit
    document.body.appendChild(form);
    form.submit();
}

// Updated playlist selection with CSRF protection
function initPlaylistSelection() {
    // Other logic remains the same
    // ...
    
    // Add form submission handling to ensure data is sent
    if (addMultipleForm) {
        addMultipleForm.addEventListener('submit', function(event) {
            // Check if any videos are selected
            const selectedVideos = document.querySelectorAll('input[name="video_ids"]');
            if (selectedVideos.length === 0) {
                event.preventDefault();
                alert('Please select at least one video to add to the queue.');
                return false;
            }
            
            // Add CSRF token if not already present
            if (!addMultipleForm.querySelector('input[name="csrf_token"]')) {
                const csrfInput = document.createElement('input');
                csrfInput.type = 'hidden';
                csrfInput.name = 'csrf_token';
                csrfInput.value = getCsrfToken();
                addMultipleForm.appendChild(csrfInput);
            }
            
            console.log(`Submitting form with ${selectedVideos.length} selected videos`);
            // Allow the form to submit
            return true;
        });
    }
    
    // Initialize
    updateSelectedVideos();
}

// Initialize all dashboard features
document.addEventListener('DOMContentLoaded', function() {
    // Initialize queue drag and drop
    initQueueDragDrop();
    
    // Initialize playlist selection
    initPlaylistSelection();
    
    // Initialize queue manager
    initQueueManager();
    
    // Add keyboard shortcut for search field
    const searchField = document.getElementById('searchQuery');
    if (searchField) {
        document.addEventListener('keydown', function(e) {
            // Ctrl+/ or Cmd+/ to focus search field
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault();
                searchField.focus();
            }
        });
    }
    
    // Convert links that should be POSTs to form submissions
    document.querySelectorAll('a[data-method="post"]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const url = this.getAttribute('href');
            const data = {};
            
            // Extract data attributes
            Object.keys(this.dataset).forEach(key => {
                if (key !== 'method') {
                    data[key] = this.dataset[key];
                }
            });
            
            // Create and submit form
            submitFormWithCsrf(url, data);
        });
    });
});