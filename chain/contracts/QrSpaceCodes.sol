// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// NFT кодов QR Space (владелец 10.10.2026: «покупают МБ под своим QR, как будто это свой маленький домен»).
/// Токен — право на код: сам код (короткая ссылка qrspace.co/K/…) не меняется и читается любой камерой.
/// Выпускает только QR Space (владелец контракта); описание токена — на сайте: baseURI + номер токена.
contract QrSpaceCodes is ERC721, Ownable {
    string private base;

    constructor(string memory baseURI_, address owner_) ERC721("QR Space Codes", "QRSC") Ownable(owner_) {
        base = baseURI_;
    }

    function mint(address to, uint256 tokenId) external onlyOwner {
        _safeMint(to, tokenId);
    }

    /// Сайт переехал — описание токенов по новому адресу.
    function setBaseURI(string calldata baseURI_) external onlyOwner {
        base = baseURI_;
    }

    function _baseURI() internal view override returns (string memory) {
        return base;
    }
}
