function initReadMore(element) {
    if (!element) return;

    const processText = () => {
        if (element.dataset.readMoreProcessed) return;

        const fullHTML = element.innerHTML;
        const maxChars = parseInt(element.dataset.maxChars) || 200;

        // Create a temporary div to get the plain text length and process nodes
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = fullHTML;
        const fullText = tempDiv.textContent || tempDiv.innerText || "";

        if (fullText.length > maxChars) {
            let truncatedHTML = '';
            let currentLength = 0;

            // Iterate through child nodes to safely truncate HTML
            for (const node of Array.from(tempDiv.childNodes)) {
                if (currentLength >= maxChars) break; // Stop if max characters reached

                if (node.nodeType === Node.TEXT_NODE) {
                    const remainingChars = maxChars - currentLength;
                    if (node.textContent.length > remainingChars) {
                        let truncatedNodeText = node.textContent.substring(0, remainingChars);
                        // Ensure we don't cut words in half
                        truncatedNodeText = truncatedNodeText.substr(0, Math.min(truncatedNodeText.length, truncatedNodeText.lastIndexOf(' ') === -1 ? truncatedNodeText.length : truncatedNodeText.lastIndexOf(' ')));
                        truncatedHTML += truncatedNodeText;
                        currentLength += truncatedNodeText.length;
                        break; // Stop after truncating a text node
                    } else {
                        truncatedHTML += node.textContent;
                        currentLength += node.textContent.length;
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    // For element nodes, append their outerHTML if they fit
                    const nodeOuterHTML = node.outerHTML;
                    const nodeTextContent = node.textContent || node.innerText || "";

                    if (currentLength + nodeTextContent.length > maxChars) {
                        // If the element's content would exceed maxChars, try to truncate its children
                        const clonedNode = node.cloneNode(false); // Clone without children
                        let innerTruncatedHTML = '';
                        let innerCurrentLength = 0;

                        for (const childNode of Array.from(node.childNodes)) {
                            if (innerCurrentLength >= (maxChars - currentLength)) break;

                            if (childNode.nodeType === Node.TEXT_NODE) {
                                const remainingInnerChars = (maxChars - currentLength) - innerCurrentLength;
                                if (childNode.textContent.length > remainingInnerChars) {
                                    let truncatedChildText = childNode.textContent.substring(0, remainingInnerChars);
                                    truncatedChildText = truncatedChildText.substr(0, Math.min(truncatedChildText.length, truncatedChildText.lastIndexOf(' ') === -1 ? truncatedChildText.length : truncatedChildText.lastIndexOf(' ')));
                                    innerTruncatedHTML += truncatedChildText;
                                    innerCurrentLength += truncatedChildText.length;
                                    break;
                                } else {
                                    innerTruncatedHTML += childNode.textContent;
                                    innerCurrentLength += childNode.textContent.length;
                                }
                            } else if (childNode.nodeType === Node.ELEMENT_NODE) {
                                // For nested elements, append their outerHTML if they fit
                                const childOuterHTML = childNode.outerHTML;
                                const childTextContent = childNode.textContent || childNode.innerText || "";
                                if (innerCurrentLength + childTextContent.length <= (maxChars - currentLength)) {
                                    innerTruncatedHTML += childOuterHTML;
                                    innerCurrentLength += childTextContent.length;
                                } else {
                                    // If nested element itself is too long, we stop here for simplicity
                                    break;
                                }
                            }
                        }
                        clonedNode.innerHTML = innerTruncatedHTML;
                        truncatedHTML += clonedNode.outerHTML;
                        currentLength += innerCurrentLength;
                        break;
                    } else {
                        truncatedHTML += nodeOuterHTML;
                        currentLength += nodeTextContent.length;
                    }
                }
            }

            const showTruncated = () => {
                element.innerHTML = truncatedHTML + '... ';
                const readMoreLink = document.createElement('a');
                readMoreLink.href = '#';
                readMoreLink.innerHTML = '<span data-i18n="readMore">mehr anzeigen</span>';
                readMoreLink.style.marginLeft = '5px';

                element.appendChild(readMoreLink);

                readMoreLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    showFull();
                });

                if (window.loadTranslations) {
                    const lang = localStorage.getItem('lang') || 'de';
                    window.loadTranslations(lang);
                }
            };

            const showFull = () => {
                const readLessLink = document.createElement('a');
                readLessLink.href = '#';
                readLessLink.setAttribute('data-i18n', 'readLess');
                readLessLink.textContent = 'weniger anzeigen';
                readLessLink.style.display = 'block';
                readLessLink.style.marginTop = '10px';

                element.innerHTML = fullHTML;
                element.appendChild(document.createElement('br'));
                element.appendChild(readLessLink);

                readLessLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    showTruncated();
                });

                if (window.loadTranslations) {
                    const lang = localStorage.getItem('lang') || 'de';
                    window.loadTranslations(lang);
                }
            };

            element.removeAttribute('data-i18n');
            element.dataset.readMoreProcessed = true;
            
            showTruncated();
        }
    };

    if (element.textContent.trim() !== '') {
        processText();
    } else {
        const observer = new MutationObserver(() => {
            if (element.textContent.trim() !== '') {
                processText();
                observer.disconnect();
            }
        });
        observer.observe(element, { childList: true, subtree: true });
    }
}