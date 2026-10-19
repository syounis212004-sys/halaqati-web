/* Browser-shaped Arabic glyphs: preserve the exact preview instead of reordering
   individual text nodes through jsPDF. Native builds retain Chromium vector PDF. */
(function () {
  'use strict';
  async function saveElement(paper,filename) {
    if(!paper)throw new Error('لا توجد معاينة للشهادة');
    await Promise.all(['html2canvas','jspdf'].map(name=>window.HalaqatiLazy.ensureLib(name)));
    await document.fonts.ready;
    const originals=[];
    for(const image of paper.querySelectorAll('img')){
      const source=image.currentSrc||image.src;if(!source||source.startsWith('data:'))continue;
      const response=await fetch(source,{cache:'force-cache'});if(!response.ok)throw new Error('تعذر تحميل إحدى صور الشهادة؛ راجع الشعار أو التوقيع');
      const blob=await response.blob(),data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('تعذرت قراءة صورة الشهادة'));reader.readAsDataURL(blob)});
      originals.push([image,image.getAttribute('src')]);image.src=data;await image.decode();
    }
    paper.dataset.certificateExport='true';
    let canvas;try{canvas=await window.html2canvas(paper,{scale:2.5,width:1122,height:794,windowWidth:1400,
      foreignObjectRendering:true,scrollX:0,scrollY:0,backgroundColor:'#ffffff',useCORS:true,logging:false,
      onclone(doc){
        doc.documentElement.style.overflow='visible';doc.body.style.overflow='visible';
        const element=doc.querySelector('[data-certificate-export="true"]');
        if(element){element.style.cssText='position:absolute;left:0;top:0;width:1122px;height:794px;transform:none';if(element.parentElement)element.parentElement.style.cssText='position:absolute;left:0;top:0;width:1122px;height:794px;transform:none';}
      }});}finally{delete paper.dataset.certificateExport;for(const [image,source] of originals)image.setAttribute('src',source);}
    if(!canvas.width||!canvas.height)throw new Error('تعذر تجهيز صورة الشهادة');
    const pdf=new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
    pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,297,210,undefined,'FAST');
    pdf.setProperties({title:'شهادة حلقاتي',subject:'شهادة باللغة العربية',creator:'Halaqati web RC27.39'});
    const bytes=pdf.output('arraybuffer').byteLength;pdf.save(filename);
    canvas.width=0;canvas.height=0;
    return {saved:true,filename,bytes,engine:'browser-arabic-preview-240dpi'};
  }
  window.HalaqatiCertificatePdf={saveElement};
})();
