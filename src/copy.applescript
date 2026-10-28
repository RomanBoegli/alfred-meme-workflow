-- Copies an image to the clipboard in several flavours at once so every app
-- can pick what it understands:
--   file URL  -> Slack, Teams, Mail, Finder attach the original file (GIFs stay animated)
--   GIF data  -> apps that accept animated pastes
--   PNG data  -> browsers, Google Docs, WhatsApp Web, ... (also converts WebP/HEIC)

use framework "Foundation"
use framework "AppKit"
use scripting additions

on run argv
	set ca to current application
	set fileURL to ca's NSURL's fileURLWithPath:(item 1 of argv)
	set ext to (fileURL's pathExtension()'s lowercaseString()) as text
	set pbItem to ca's NSPasteboardItem's new()

	pbItem's setString:((fileURL's absoluteString()) as text) forType:"public.file-url"

	if ext is "gif" then
		pbItem's setData:(ca's NSData's dataWithContentsOfURL:fileURL) forType:"com.compuserve.gif"
	end if

	set img to ca's NSImage's alloc()'s initWithContentsOfURL:fileURL
	if img is not missing value then
		set rep to ca's NSBitmapImageRep's imageRepWithData:(img's TIFFRepresentation())
		set pngData to rep's representationUsingType:(ca's NSBitmapImageFileTypePNG) |properties|:(ca's NSDictionary's dictionary())
		pbItem's setData:pngData forType:"public.png"
	end if

	set pb to ca's NSPasteboard's generalPasteboard()
	pb's clearContents()
	pb's writeObjects:{pbItem}
end run
