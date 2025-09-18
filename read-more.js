function initReadMore(element) {
    if (!element) return;

    const process = () => {
        // If the element is already processed, do nothing.
        if (element.dataset.readMoreProcessed) return;

    const fullHTML = element.innerHTML;
    const maxChars = parseInt(element.dataset.maxChars, 10) || 200;

        // Check if the text content is long enough to be truncated.
        if (element.textContent.length <= maxChars) return;

        // --- Truncation logic ---
        let truncatedHTML = '';
        let currentLength = 0;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = fullHTML;

        // Iterate through nodes to safely truncate HTML
        for (const node of Array.from(tempDiv.childNodes)) {
            const nodeText = node.textContent;
            if (currentLength + nodeText.length > maxChars) {
                const remainingChars = maxChars - currentLength;
                const slice = nodeText.substring(0, remainingChars);
                const cutAt = slice.lastIndexOf(' ');
                const truncatedNodeText = cutAt > 0 ? slice.substring(0, cutAt) : slice;

                if (node.nodeType === Node.TEXT_NODE) {
                    truncatedHTML += truncatedNodeText;
                } else {
                    // Preserve element tag but truncate its text content
                    const newNode = node.cloneNode(false);
                    newNode.textContent = truncatedNodeText;
                    truncatedHTML += newNode.outerHTML || newNode.textContent;
                }
                break; 
            } else {
                truncatedHTML += node.outerHTML || node.textContent;
                currentLength += nodeText.length;
            }
        }

        const showTruncated = () => {
            element.innerHTML = truncatedHTML + '... ';
            const readMoreLink = document.createElement('a');
            readMoreLink.href = '#';
            readMoreLink.textContent = 'mehr anzeigen';
            readMoreLink.style.marginLeft = '5px';
            element.appendChild(readMoreLink);

            readMoreLink.addEventListener('click', (e) => {
                e.preventDefault();
                showFull();
            });
        };

        const showFull = () => {
            element.innerHTML = fullHTML;
            const readLessLink = document.createElement('a');
            readLessLink.href = '#';
            readLessLink.textContent = 'weniger anzeigen';
            readLessLink.style.display = 'block';
            readLessLink.style.marginTop = '10px';
            element.appendChild(document.createElement('br'));
            element.appendChild(readLessLink);

            readLessLink.addEventListener('click', (e) => {
                e.preventDefault();
                showTruncated();
            });
        };

        showTruncated();
        element.dataset.readMoreProcessed = true;
    };

    // Wait for content to appear before processing.
    if (element.textContent.trim() !== '') {
        process();
    } else {
        const observer = new MutationObserver(() => {
            if (element.textContent.trim() !== '') {
                process();
                observer.disconnect();
            }
        });
        observer.observe(element, { childList: true, subtree: true });
    }
}