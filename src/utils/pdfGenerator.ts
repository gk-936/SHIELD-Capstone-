import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateIncidentReportPDF = (reportData: any) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // White Theme Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setTextColor(15, 23, 42); // slate-900 text color
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');

  doc.text('SHIELD INCIDENT REPORT', pageWidth / 2, 60, { align: 'center' });   

  doc.setLineWidth(1);
  doc.setDrawColor(14, 165, 233); // sky-500 accent
  doc.line(40, 80, pageWidth - 40, 80);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 110);
  doc.text(`Classification: CONFIDENTIAL`, 40, 130);


  if (reportData.title) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Target Profile: ${reportData.title}`, 40, 170);
  }

  // Define fields to show in the summary table
  const tableData = [
    ['Report ID', reportData.reportId || 'N/A'],
    ['Incident ID', reportData.incidentId || 'N/A'],
    ['Timestamp', reportData.timestamp ? new Date(reportData.timestamp).toLocaleString() : 'N/A'],
    ['Severity', reportData.severity || 'N/A'],
    ['Ransomware Family', reportData.ransomwareFamily || 'Unknown'],
    ['Affected PID', reportData.affectedPid ? String(reportData.affectedPid) : 'N/A'],
  ];

  // Draw table using autoTable
  autoTable(doc, {
    startY: 190,
    head: [['Attribute', 'Details']],
    body: tableData,
    theme: 'grid',
    styles: {
      fillColor: [248, 250, 252], // slate-50
      textColor: [15, 23, 42], // slate-900
      lineColor: [203, 213, 225], // slate-300
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [15, 23, 42], // slate-900
      textColor: [255, 255, 255], 
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255], // white
    },
    margin: { left: 40, right: 40 },
  });

  // Handle HTML content by parsing elements selectively
  if (reportData.htmlContent) {
    let currentY = (doc as any).lastAutoTable.finalY + 40 || 350;

    const tmp = document.createElement("DIV");
    tmp.innerHTML = reportData.htmlContent;
    
    // Parse the inner html blocks
    const childNodes = Array.from(tmp.childNodes);
    
    childNodes.forEach((node) => {
      // Add page if getting too close to bottom
      if (currentY > pageHeight - 60) {
        doc.addPage();
        currentY = 40;
      }

      const isTextNode = node.nodeType === Node.TEXT_NODE;
      const isElementNode = node.nodeType === Node.ELEMENT_NODE;

      if (isTextNode) {
         const text = node.textContent?.trim();
         if (text) {
           doc.setFontSize(11);
           doc.setFont('helvetica', 'normal');
           doc.setTextColor(71, 85, 105); // slate-600
           const splitText = doc.splitTextToSize(text, pageWidth - 80);
           doc.text(splitText, 40, currentY);
           currentY += (splitText.length * 15) + 5;
         }
      } else if (isElementNode) {
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();
        
        if (tag === 'h2') {
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(15, 23, 42); // slate-900
          currentY += 10;
          doc.text(el.textContent || '', 40, currentY);
          currentY += 20;
        } else if (tag === 'h3') {
          doc.setFontSize(13);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 41, 59); // slate-800
          currentY += 10;
          doc.text(el.textContent || '', 40, currentY);
          currentY += 15;
        } else if (tag === 'ul' || tag === 'ol') {
          const listItems = Array.from(el.querySelectorAll('li'));
          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(71, 85, 105); // slate-600
          
          listItems.forEach((li) => {
            if (currentY > pageHeight - 60) { doc.addPage(); currentY = 40; }
            const splitText = doc.splitTextToSize(`• ${li.textContent}`, pageWidth - 90);
            doc.text(splitText, 50, currentY);
            currentY += (splitText.length * 15) + 5;
          });
          currentY += 5;
        } else {
          // fallback for paragraphs, divs
          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(71, 85, 105); // slate-600
          const text = el.textContent?.trim() || '';
          if (text) {
             const splitText = doc.splitTextToSize(text, pageWidth - 80);
             doc.text(splitText, 40, currentY);
             currentY += (splitText.length * 15) + 10;
          }
        }
      }
    });
  }

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('SHIELD Cyber Defense Network - Unauthorized distribution prohibited.', pageWidth / 2, pageHeight - 40, { align: 'center' });

  doc.save(`Shield_Report_${new Date().getTime()}.pdf`);
};