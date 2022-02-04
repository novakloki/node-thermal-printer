const PrinterType = require("./printer-type");

class Tp8017 extends PrinterType {
  constructor() {
    super();
    this.config = require("./tp8017-config");
  }

  // ------------------------------ Append ------------------------------
  append(appendBuffer) {
    if (this.buffer) {
      this.buffer = Buffer.concat([this.buffer, appendBuffer]);
    } else {
      this.buffer = appendBuffer;
    }
  }

  // ------------------------------ Set text size ------------------------------
  setTextSize(height, width) {
    this.buffer = null;
    if (height > 7 || height < 0)
      throw new Error("setTextSize: Height must be between 0 and 7");
    if (width > 7 || width < 0)
      throw new Error("setTextSize: Width must be between 0 and 7");
    let x = Buffer.from(height + "" + width, "hex");
    this.append(Buffer.from([0x1d, 0x21]));
    this.append(x);
    return this.buffer;
  }

  printImageBuffer(width, height, data) {
    this.buffer = null;

    // Get pixel rgba in 2D array
    var pixels = [];
    for (var i = 0; i < height; i++) {
      var line = [];
      for (var j = 0; j < width; j++) {
        var idx = (width * i + j) << 2;
        line.push({
          r: data[idx],
          g: data[idx + 1],
          b: data[idx + 2],
          a: data[idx + 3]
        });
      }
      pixels.push(line);
    }


    var imageBuffer_array = [];
    for (var i = 0; i < height; i++) {
      for (var j = 0; j < Math.ceil(width / 8); j++) {
        var byte = 0x0;
        for (var k = 0; k < 8; k++) {
          var pixel = pixels[i][j * 8 + k];

          // Image overflow
          if (pixel === undefined) {
            pixel = {
              a: 0,
              r: 0,
              g: 0,
              b: 0
            };
          }

          if (pixel.a > 126) { // checking transparency
            var grayscale = parseInt(0.2126 * pixel.r + 0.7152 * pixel.g + 0.0722 * pixel.b);

            if (grayscale < 128) { // checking color
              var mask = 1 << 7 - k; // setting bitwise mask
              byte |= mask; // setting the correct bit to 1
            }
          }
        }

        imageBuffer_array.push(byte);
        // imageBuffer = Buffer.concat([imageBuffer, Buffer.from([byte])]);
      }
    }

    let imageBuffer = Buffer.from(imageBuffer_array);

    // Print raster bit image
    // GS v 0
    // 1D 76 30	m	xL xH	yL yH d1...dk
    // xL = (this.width >> 3) & 0xff;
    // xH = 0x00;
    // yL = this.height & 0xff;
    // yH = (this.height >> 8) & 0xff;
    // https://reference.epson-biz.com/modules/ref_escpos/index.php?content_id=94

    // Check if width/8 is decimal
    if (width % 8 != 0) {
      width += 8;
    }

    this.append(Buffer.from([0x1d, 0x76, 0x30, 48]));
    this.append(Buffer.from([(width >> 3) & 0xff]));
    this.append(Buffer.from([0x00]));
    this.append(Buffer.from([height & 0xff]));
    this.append(Buffer.from([(height >> 8) & 0xff]));

    // append data
    this.append(imageBuffer);

    return this.buffer;
  }
}

module.exports = Tp8017;
