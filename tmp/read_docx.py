import zipfile
import xml.etree.ElementTree as ET

def get_docx_text(path):
    """
    Extracts text from a docx file by reading the word/document.xml.
    """
    with zipfile.ZipFile(path) as z:
        content = z.read('word/document.xml')
    
    root = ET.fromstring(content)
    
    # Define the namespaces
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    
    # Find all text elements
    paragraphs = []
    for p in root.findall('.//w:p', ns):
        texts = [t.text for t in p.findall('.//w:t', ns) if t.text]
        if texts:
            paragraphs.append("".join(texts))
    
    return "\n".join(paragraphs)

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python read_docx.py <input_docx> <output_txt>", file=sys.stderr)
        sys.exit(1)
    try:
        text = get_docx_text(sys.argv[1])
        with open(sys.argv[2], 'w', encoding='utf-8') as f:
            f.write(text)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
